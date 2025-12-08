import os
import re
import requests
import sys
from urllib.parse import urlparse
from pathlib import Path

def download_and_replace_images(post_file, images_dir="images"):
    """
    Scans a markdown file, downloads images from external URLs, 
    saves them to a local directory, and replaces the URLs in the file.
    """
    # Get Notion API token from environment variable
    NOTION_TOKEN = os.getenv("NOTION_TOKEN")
    
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
    }

    try:
        with open(post_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"❌ Error reading file {post_file}: {e}")
        return

    # Regex to find markdown image syntax with any external URL
    # ![alt_text](http_url)
    image_regex = re.compile(r'!\[(.*?)\]\((https?:\/\/[^\)]+)\)')
    
    matches = image_regex.findall(content)
    if not matches:
        # print(f"No external images found in {post_file}.")
        return

    print(f"🖼️ Found {len(matches)} external image(s) in {post_file}.")

    # Ensure the target directory exists
    Path(images_dir).mkdir(exist_ok=True)

    # Get the base name of the post file for unique image naming
    post_basename = Path(post_file).stem
    
    modified = False
    for i, (alt_text, url) in enumerate(matches):
        try:
            # Generate a unique filename
            parsed_url = urlparse(url)
            # Get the file extension from the URL path
            file_ext = Path(parsed_url.path).suffix or '.png' # Default to .png if no extension
            new_filename = f"{post_basename}-{i+1}{file_ext}"
            image_path = Path(images_dir) / new_filename

            # Use headers for the download request if it's a Notion URL
            if "notion.so" in url or "notion-static.com" in url:
                if not NOTION_TOKEN:
                    print(f"  ⚠️ Skipping Notion URL (NOTION_TOKEN not set): {url}")
                    continue
                response = requests.get(url, headers=headers, stream=True)
            else:
                response = requests.get(url, stream=True)

            response.raise_for_status()

            with open(image_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            print(f"  ✅ Downloaded {url} to {image_path}")

            # Replace the old URL with the new relative URL
            new_url = f"/images/{new_filename}" # Use root-relative path
            content = content.replace(url, new_url)
            modified = True

        except requests.exceptions.RequestException as e:
            print(f"  ❌ Failed to download {url}: {e}")
        except Exception as e:
            print(f"  ❌ An error occurred: {e}")

    if modified:
        try:
            with open(post_file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  💾 Successfully updated links in {post_file}")
        except Exception as e:
            print(f"  ❌ Error writing updated file {post_file}: {e}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python image_helper.py <directory_to_scan>")
        sys.exit(1)
        
    scan_dir = sys.argv[1]
    
    if not Path(scan_dir).is_dir():
        print(f"Error: Directory '{scan_dir}' not found.")
        sys.exit(1)

    print(f"🚀 Starting image processing in '{scan_dir}'...")
    
    for root, _, files in os.walk(scan_dir):
        for file in files:
            if file.endswith('.md'):
                post_path = Path(root) / file
                download_and_replace_images(str(post_path))
    
    print("✅ Image processing complete.")

if __name__ == "__main__":
    main()
