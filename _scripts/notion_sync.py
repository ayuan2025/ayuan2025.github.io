import os
import requests
from datetime import datetime
from markdown_it import MarkdownIt
import shutil
from pypinyin import lazy_pinyin

NOTION_TOKEN = os.getenv("NOTION_TOKEN")
DATABASE_ID = os.getenv("NOTION_DATABASE_ID")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "_posts")

HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

def query_database():
    """Queries the Notion database for published pages."""
    url = f"https://api.notion.com/v1/databases/{DATABASE_ID}/query"
    payload = {
        "page_size": 100,
        "filter": {
            "property": "Status",
            "status": {
                "equals": "Published"
            }
        },
        "sorts": [
            {
                "property": "Created time",
                "direction": "descending"
            }
        ]
    }
    
    try:
        res = requests.post(url, headers=HEADERS, json=payload)
        res.raise_for_status()
        data = res.json()
        return data.get("results", [])
    except requests.exceptions.RequestException as e:
        print(f"ERROR: 查询 Notion 数据库失败 - {e}")
        return []

def get_blocks(block_id):
    """Fetches all blocks (content) for a given page or block."""
    url = f"https://api.notion.com/v1/blocks/{block_id}/children?page_size=100"
    try:
        res = requests.get(url, headers=HEADERS)
        res.raise_for_status()
        return res.json().get("results", [])
    except requests.exceptions.RequestException as e:
        print(f"ERROR: 获取块内容失败 - {e}")
        return []

def get_title_and_tags_and_date(page):
    """Extracts title, tags, and date from page properties."""
    title = "Untitled"
    tags = []
    date_str = datetime.now().strftime("%Y-%m-%d")
    
    for prop_name, prop_value in page.get("properties", {}).items():
        if prop_value.get("type") == "title":
            title_list = prop_value.get("title", [])
            if title_list:
                title = title_list[0].get("plain_text", "Untitled")
        elif prop_value.get("type") == "multi_select":
            select_options = prop_value.get("multi_select", [])
            for option in select_options:
                tags.append(option.get("name"))
        elif prop_value.get("type") == "date":
            date_info = prop_value.get("date")
            if date_info and date_info.get("start"):
                date_str = date_info.get("start")
                
    return title, tags, date_str

def block_to_md(block):
    """Converts a single Notion block to Markdown format."""
    # ... (此函数代码与之前版本相同，省略) ...
    md_instance = MarkdownIt()
    btype = block.get("type")
    if btype == "paragraph":
        texts = block[btype].get("rich_text", [])
        content = "".join([t.get("plain_text", "") for t in texts])
        return md_instance.render(content) + "\n"
    elif btype == "heading_1":
        texts = block[btype].get("rich_text", [])
        content = "".join([t.get("plain_text", "") for t in texts])
        return "# " + content + "\n\n"
    elif btype == "heading_2":
        texts = block[btype].get("rich_text", [])
        content = "".join([t.get("plain_text", "") for t in texts])
        return "## " + content + "\n\n"
    elif btype == "heading_3":
        texts = block[btype].get("rich_text", [])
        content = "".join([t.get("plain_text", "") for t in texts])
        return "### " + content + "\n\n"
    elif btype == "bulleted_list_item":
        texts = block[btype].get("rich_text", [])
        content = "".join([t.get("plain_text", "") for t in texts])
        return "- " + content + "\n"
    elif btype == "numbered_list_item":
        texts = block[btype].get("rich_text", [])
        content = "".join([t.get("plain_text", "") for t in texts])
        return "1. " + content + "\n"
    elif btype == "quote":
        texts = block[btype].get("rich_text", [])
        content = "".join([t.get("plain_text", "") for t in texts])
        return "> " + content + "\n\n"
    elif btype == "code":
        texts = block[btype].get("rich_text", [])
        code_text = "".join([t.get("plain_text", "") for t in texts])
        language = block[btype].get("language", "")
        return f"```{language}\n{code_text}\n```\n\n"
    return ""

def sanitize_filename(s):
    """Sanitizes a string to be a valid filename."""
    s = s.strip()
    s = s.replace(" ", "-")
    return "".join(c for c in s if c.isalnum() or c in "-_.")

def save_page_as_markdown(page):
    """Saves a Notion page to a Markdown file."""
    title, tags, date_str = get_title_and_tags_and_date(page)
    page_id = page["id"]

    blocks = get_blocks(page_id)
    if not blocks:
        return
        
    md_instance = MarkdownIt()
    
    # 📌 新增：生成一个英文 slug
    slug = "-".join(lazy_pinyin(title))
    
    front_matter = [
        "---",
        "layout: post", # 确保使用 post 布局
        f"title: \"{title}\"",
        f"slug: {slug}", # 📌 新增：slug 属性
        f"date: {date_str} 12:00:00 +0800",
        f"notion_id: {page_id}",
    ]
    if tags:
        front_matter.append("tags:")
        for tag in tags:
            front_matter.append(f"  - \"{tag}\"")
            
    front_matter.append("---")
    
    front_matter_str = "\n".join(front_matter) + "\n\n"
    
    md_lines = []
    for block in blocks:
        md_lines.append(block_to_md(block))
    
    content_str = "".join(md_lines)

    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    # 📌 修改：文件名使用 slug，而不是中文标题
    file_path = os.path.join(OUTPUT_DIR, f"{date_str}-{slug}.md")
    
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(front_matter_str + content_str)
    except Exception as e:
        print(f"ERROR: 导出文件失败 - {e}")

def main():
    # ... (此函数代码与之前版本相同，省略) ...
    # 清空目录
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
    os.makedirs(OUTPUT_DIR)
    
    pages = query_database()
    
    if not pages:
        print("WARNING: 未找到任何要处理的页面。")
    
    for page in pages:
        save_page_as_markdown(page)

if __name__ == "__main__":
    main()
