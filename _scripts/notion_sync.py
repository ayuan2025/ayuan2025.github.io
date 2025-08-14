import os
import requests
from datetime import datetime
from markdown_it import MarkdownIt
import shutil

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
    
    # 📌 修正1: 增加筛选器，只获取 "Status" 为 "Published" 的页面
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
    
    res = requests.post(url, headers=HEADERS, json=payload)
    res.raise_for_status()
    data = res.json()
    print(f"📄 查询到 {len(data.get('results', []))} 个页面")
    return data.get("results", [])

def get_page(page_id):
    """Fetches a single Notion page."""
    url = f"https://api.notion.com/v1/pages/{page_id}"
    res = requests.get(url, headers=HEADERS)
    res.raise_for_status()
    return res.json()

def get_blocks(block_id):
    """Fetches all blocks (content) for a given page or block."""
    url = f"https://api.notion.com/v1/blocks/{block_id}/children?page_size=100"
    res = requests.get(url, headers=HEADERS)
    res.raise_for_status()
    return res.json().get("results", [])

def get_title_and_tags_and_date(page):
    """Extracts title, tags, and date from page properties."""
    title = "Untitled"
    tags = []
    date_str = datetime.now().strftime("%Y-%m-%d")
    
    for prop_name, prop_value in page["properties"].items():
        if prop_value.get("type") == "title":
            title_list = prop_value.get("title", [])
            if title_list:
                title = title_list[0].get("plain_text", "Untitled")
        elif prop_value.get("type") == "multi_select":
            select_options = prop_value.get("multi_select", [])
            for option in select_options:
                tags.append(option.get("name"))
        # 📌 修正2: 从 Notion 属性中获取日期，而不是使用当前时间
        elif prop_value.get("type") == "date":
            date_info = prop_value.get("date")
            if date_info and date_info.get("start"):
                date_str = date_info.get("start")
                
    return title, tags, date_str

def block_to_md(block):
    """Converts a single Notion block to Markdown format."""
    md_instance = MarkdownIt()
    btype = block.get("type")
    
    if btype == "paragraph":
        # 📌 修正3: 处理富文本格式，而不是只取纯文本
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
        return f
