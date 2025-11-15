import os
import requests
from datetime import datetime
import shutil
from pypinyin import lazy_pinyin
import yaml
import re

# --- Configuration ---
NOTION_TOKEN = os.getenv("NOTION_TOKEN")
DATABASE_ID = os.getenv("NOTION_DATABASE_ID")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "_posts")
HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

# --- Notion API Functions ---
def query_database():
    """Queries the Notion database for published pages."""
    url = f"https://api.notion.com/v1/databases/{DATABASE_ID}/query"
    payload = {
        "page_size": 100,
        "filter": {"property": "Status", "status": {"equals": "Published"}},
        "sorts": [{"property": "Created time", "direction": "descending"}]
    }
    try:
        res = requests.post(url, headers=HEADERS, json=payload)
        res.raise_for_status()
        return res.json().get("results", [])
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Failed to query Notion database - {e}")
        return []

def get_blocks(block_id):
    """Fetches all blocks (content) for a given page."""
    url = f"https://api.notion.com/v1/blocks/{block_id}/children?page_size=100"
    try:
        res = requests.get(url, headers=HEADERS)
        res.raise_for_status()
        return res.json().get("results", [])
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Failed to get block content - {e}")
        return []

# --- Markdown Conversion ---
def get_page_properties(page):
    """Extracts title, tags, date, and last edited time from page properties."""
    props = page.get("properties", {})
    title = "Untitled"
    tags = []
    date_str = datetime.now().strftime("%Y-%m-%d")
    
    for prop_name, prop_value in props.items():
        if prop_value.get("type") == "title":
            if prop_value["title"]:
                title = prop_value["title"][0].get("plain_text", "Untitled")
        elif prop_value.get("type") == "multi_select":
            tags = [opt["name"] for opt in prop_value["multi_select"]]
        elif prop_value.get("type") == "date":
            if prop_value["date"] and prop_value["date"]["start"]:
                date_str = prop_value["date"]["start"]
                
    return title, tags, date_str, page["last_edited_time"]

def block_to_md(block):
    """Converts a single Notion block to Markdown format."""
    btype = block.get("type")
    content_obj = block.get(btype, {})
    rich_text = content_obj.get("rich_text", [])
    text = "".join([t.get("plain_text", "") for t in rich_text])

    if btype == "paragraph":
        return text + "\n\n"
    if btype.startswith("heading_"):
        level = btype.split("_")[-1]
        return f"{'#' * int(level)} {text}\n\n"
    if btype == "bulleted_list_item":
        return f"- {text}\n"
    if btype == "numbered_list_item":
        return f"1. {text}\n"
    if btype == "quote":
        return f"> {text}\n\n"
    if btype == "code":
        language = content_obj.get("language", "")
        return f"```{language}\n{text}\n```\n\n"
    return ""

def save_page_as_markdown(page):
    """Saves a Notion page to a Markdown file."""
    title, tags, date_str, last_edited_time = get_page_properties(page)
    page_id = page["id"]
    slug = "-".join(lazy_pinyin(title)) if title else "untitled"

    blocks = get_blocks(page_id)
    if not blocks:
        print(f"WARNING: Skipping page '{title}' as it has no content blocks.")
        return

    front_matter = {
        "layout": "post",
        "title": title,
        "slug": slug,
        "date": f"{date_str} 12:00:00 +0800",
        "notion_id": page_id,
        "last_synced_time": last_edited_time
    }
    if tags:
        front_matter["tags"] = tags
    
    front_matter_str = f"---\n{yaml.dump(front_matter, allow_unicode=True)}---\n\n"
    
    content_str = "".join([block_to_md(block) for block in blocks])
    
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    file_path = os.path.join(OUTPUT_DIR, f"{date_str}-{slug}.md")
    
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(front_matter_str + content_str)
    except Exception as e:
        print(f"ERROR: Failed to write file {file_path} - {e}")

# --- Sync Logic ---
def get_local_posts():
    """Scans the output directory and returns a map of local posts."""
    local_posts = {}
    if not os.path.exists(OUTPUT_DIR):
        return local_posts

    for filename in os.listdir(OUTPUT_DIR):
        if not filename.endswith(".md"):
            continue
        
        file_path = os.path.join(OUTPUT_DIR, filename)
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                # Use regex to extract YAML front matter
                match = re.match(r"---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
                if not match:
                    continue
                
                front_matter = yaml.safe_load(match.group(1))
                if "notion_id" in front_matter:
                    local_posts[front_matter["notion_id"]] = {
                        "path": file_path,
                        "last_synced": front_matter.get("last_synced_time", "")
                    }
        except (IOError, yaml.YAMLError) as e:
            print(f"WARNING: Could not read or parse {file_path} - {e}")
            
    return local_posts

def main():
    """Main function to run the sync process."""
    print("Starting Notion sync...")
    local_posts = get_local_posts()
    remote_pages = query_database()
    remote_pages_map = {page['id']: page for page in remote_pages}

    # --- Step 1: Delete posts that are no longer on Notion ---
    local_ids = set(local_posts.keys())
    remote_ids = set(remote_pages_map.keys())
    to_delete_ids = local_ids - remote_ids
    
    for notion_id in to_delete_ids:
        file_path = local_posts[notion_id]["path"]
        try:
            os.remove(file_path)
            print(f"DELETE: '{os.path.basename(file_path)}' (Reason: No longer published on Notion)")
        except OSError as e:
            print(f"ERROR: Failed to delete {file_path} - {e}")

    # --- Step 2: Create or Update posts ---
    for notion_id, page in remote_pages_map.items():
        title, _, _, _ = get_page_properties(page)
        remote_last_edited = page['last_edited_time']

        if notion_id not in local_posts:
            print(f"CREATE: '{title}'")
            save_page_as_markdown(page)
        else:
            local_last_synced = local_posts[notion_id]['last_synced']
            if remote_last_edited > local_last_synced:
                print(f"UPDATE: '{title}' (Reason: Updated on Notion)")
                save_page_as_markdown(page)
    
    print("Notion sync finished.")

if __name__ == "__main__":
    main()
