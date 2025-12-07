import os
import requests
from datetime import datetime
from markdown_it import MarkdownIt
import shutil
import yaml

NOTION_TOKEN = os.getenv("NOTION_TOKEN")
DATABASE_ID = os.getenv("NOTION_DATABASE_ID")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "_posts")

HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

def query_database():
    url = f"https://api.notion.com/v1/databases/{DATABASE_ID}/query"
    payload = {"page_size": 100}
    res = requests.post(url, headers=HEADERS, json=payload)
    res.raise_for_status()
    data = res.json()
    print(f"📄 查询到 {len(data.get('results', []))} 个页面")
    return data.get("results", [])

def get_page(page_id):
    url = f"https://api.notion.com/v1/pages/{page_id}"
    res = requests.get(url, headers=HEADERS)
    res.raise_for_status()
    return res.json()

def get_blocks(block_id):
    url = f"https://api.notion.com/v1/blocks/{block_id}/children?page_size=100"
    res = requests.get(url, headers=HEADERS)
    res.raise_for_status()
    return res.json().get("results", [])

def find_post_by_notion_id(notion_id):
    """Scans the output directory for a post with a matching notion_id in its front matter."""
    if not os.path.exists(OUTPUT_DIR):
        return None
    for filename in os.listdir(OUTPUT_DIR):
        if filename.endswith(".md"):
            filepath = os.path.join(OUTPUT_DIR, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                    if "---" in content:
                        parts = content.split("---")
                        if len(parts) > 2:
                            front_matter = yaml.safe_load(parts[1])
                            if front_matter and front_matter.get("notion_id") == notion_id:
                                return filepath
            except (yaml.YAMLError, IOError) as e:
                print(f"⚠️  Error reading or parsing {filepath}: {e}")
    return None

def get_page_metadata(page):
    """Extracts title, tags, and publication date from a Notion page."""
    properties = page.get("properties", {})
    title = "Untitled"
    tags = []
    date_str = datetime.strptime(page["created_time"], "%Y-%m-%dT%H:%M:%S.%fZ").strftime("%Y-%m-%d")

    for prop_name, prop_value in properties.items():
        if prop_value.get("type") == "title":
            title_list = prop_value.get("title", [])
            if title_list:
                title = title_list[0].get("plain_text", "Untitled")
        
        if prop_value.get("type") == "multi_select":
            select_options = prop_value.get("multi_select", [])
            tags = [option.get("name") for option in select_options]

        # Look for a date property, e.g., named "发布日期" or "Date"
        if prop_value.get("type") == "date" and prop_value.get("date"):
            # Use the start date of the date range
            date_str = prop_value["date"].get("start", date_str)

    return title, tags, date_str

def block_to_md(block, md_instance):
    btype = block.get("type")
    content_list = block.get(btype, {}).get("rich_text", [])
    content = "".join([t.get("plain_text", "") for t in content_list])

    if btype == "paragraph":
        return content + "\n\n"
    if btype in ["heading_1", "heading_2", "heading_3"]:
        level = btype.split("_")[-1]
        return f"{'#' * int(level)} {content}\n\n"
    if btype == "bulleted_list_item":
        return f"- {content}\n"
    if btype == "numbered_list_item":
        return f"1. {content}\n"
    if btype == "quote":
        return f"> {content}\n\n"
    if btype == "code":
        language = block.get(btype, {}).get("language", "text")
        return f"```{language}\n{content}\n```\n\n"
    if btype == "image":
        image_type = block.get("image", {}).get("type")
        if image_type == "external":
            url = block["image"]["external"]["url"]
            return f"![Image]({url})\n\n"
        # Note: Internal/hosted images require more complex handling (downloading the image)
        # which is not implemented here.
    return ""

def sanitize_filename(s):
    s = s.strip().replace(" ", "-")
    return "".join(c for c in s if c.isalnum() or c == "-")

def process_and_save_page(page):
    """Processes a single Notion page and saves it as a markdown file if it doesn't already exist."""
    page_id = page["id"]
    
    existing_post = find_post_by_notion_id(page_id)
    if existing_post:
        print(f"🔄  Skipping existing post: {os.path.basename(existing_post)}")
        return

    print(f"✨  Processing new page: {page_id}")
    title, tags, date_str = get_page_metadata(page)
    
    blocks = get_blocks(page_id)
    md_instance = MarkdownIt()
    
    front_matter = [
        "---",
        f"title: \"{title}\"",
        f"date: {date_str}",
        f"notion_id: {page_id}",
    ]
    if tags:
        front_matter.append("tags:")
        front_matter.extend([f"  - \"{tag}\"" for tag in tags])
    front_matter.append("---")
    
    front_matter_str = "\n".join(front_matter) + "\n\n"

    md_content = "".join([block_to_md(block, md_instance) for block in blocks])

    safe_title = sanitize_filename(title)
    file_path = os.path.join(OUTPUT_DIR, f"{date_str}-{safe_title}.md")
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(front_matter_str + md_content)
        
    print(f"✅  Exported page: {title} -> {file_path}")

def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
    
    pages = query_database()
    for page in pages:
        process_and_save_page(page)

if __name__ == "__main__":
    main()
