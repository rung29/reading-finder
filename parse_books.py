import os
import glob
import json
import re

def parse_html_file(file_path):
    print(f"正在解析: {file_path}")
    books = []
    
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # 使用正則表達式快速且無外部依賴地解析表格列
    # 匹配 <tr>...</tr>
    rows = re.findall(r'<tr>(.*?)</tr>', content, re.DOTALL)
    
    for row in rows:
        # 跳過表頭
        if "<th>" in row:
            continue
            
        # 匹配所有 <td>
        tds = re.findall(r'<td.*?>(.*?)</td>', row, re.DOTALL)
        if len(tds) < 6:
            continue
            
        try:
            # 1. 序號
            seq = re.sub(r'<[^>]+>', '', tds[0]).strip()
            
            # 2. 書名與詳細頁連結
            title_td = tds[1]
            title_match = re.search(r'href="([^"]+)".*?>(.*?)</a>', title_td, re.DOTALL)
            if title_match:
                link = title_match.group(1).strip()
                title = re.sub(r'<[^>]+>', '', title_match.group(2)).strip()
            else:
                link = ""
                title = re.sub(r'<[^>]+>', '', title_td).strip()
                
            # 3. 作者
            author = re.sub(r'<[^>]+>', '', tds[2]).strip()
            
            # 4. 出版社
            publisher = re.sub(r'<[^>]+>', '', tds[3]).strip()
            
            # 5. 適讀年段
            age_group = re.sub(r'<[^>]+>', '', tds[4]).strip()
            
            # 6. 認證狀態
            status_text = re.sub(r'<[^>]+>', '', tds[5]).strip()
            is_certified = "可認證" in status_text
            
            books.append({
                "title": title,
                "link": link,
                "author": author,
                "publisher": publisher,
                "age_group": age_group,
                "certified": is_certified
            })
        except Exception as e:
            print(f"解析列時出錯: {e}")
            
    return books

def main():
    source_dir = r"D:\github\book-searcher"
    target_json = r"d:\github\reading-finder\books.json"
    
    # 尋找 books_page_*.html 但排除含有 _with_library 或 _rechecked 的檔案
    pattern = os.path.join(source_dir, "books_page_*.html")
    html_files = [f for f in glob.glob(pattern) if not ("_with_library" in f or "_rechecked" in f)]
    
    # 依頁數排序檔案以維持原本的順序
    def get_page_num(path):
        match = re.search(r'books_page_(\d+)\.html$', path)
        return int(match.group(1)) if match else 0
        
    html_files.sort(key=get_page_num)
    
    all_books = []
    seen_titles = set()
    
    for file_path in html_files:
        books = parse_html_file(file_path)
        for b in books:
            # 簡單去重：如果書名、作者、出版社皆相同，則視為重複
            key = (b["title"], b["author"], b["publisher"])
            if key not in seen_titles:
                seen_titles.add(key)
                all_books.append(b)
                
    # 寫入 JSON
    with open(target_json, "w", encoding="utf-8") as f:
        json.dump(all_books, f, ensure_ascii=False, indent=2)
        
    print(f"\n轉換完成！共解析 {len(html_files)} 個 HTML 檔，取得 {len(all_books)} 本書籍。")
    print(f"已儲存至: {target_json}")

if __name__ == "__main__":
    main()
