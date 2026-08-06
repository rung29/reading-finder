import os
import re
import sys
import urllib.parse
import requests
from bs4 import BeautifulSoup


class SourceStructureError(RuntimeError):
    """Raised when a source page no longer has a recognized result structure."""


def fetch_search_session():
    """
    初始化 Session，獲取 CSRF Token 並下載驗證碼圖片
    """
    base_url = "https://read.chc.edu.tw/index.php"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    # 關閉 SSL 憑證警告訊息
    requests.packages.urllib3.disable_warnings(requests.packages.urllib3.exceptions.InsecureRequestWarning)

    session = requests.Session()

    print("1. 正在初始化網站連線，取得安全金鑰 (CSRF Token)...")
    try:
        res = session.get(base_url, params={"inter": "books", "kind": "cht"}, headers=headers, verify=False, timeout=15)
        res.raise_for_status()
    except requests.RequestException as e:
        print(f"初始化失敗：{e}", file=sys.stderr)
        return None, None
        
    soup = BeautifulSoup(res.text, "html.parser")
    csrf_token_input = soup.find("input", {"name": "csrf_token"})
    csrf_token = csrf_token_input["value"] if csrf_token_input else ""
    
    # 尋找驗證碼圖片
    captcha_img = soup.find("img", {"id": "captcha_image"})
    if not captcha_img:
        print("找不到驗證碼圖片！伺服器結構可能已變更。", file=sys.stderr)
        return None, None
        
    captcha_src = captcha_img["src"]
    captcha_url = urllib.parse.urljoin(base_url, captcha_src)
    
    # 下載驗證碼圖片
    print("2. 正在下載驗證碼圖片...")
    try:
        captcha_res = session.get(captcha_url, headers=headers, verify=False, timeout=15)
        captcha_res.raise_for_status()
    except requests.RequestException as e:
        print(f"驗證碼圖片下載失敗：{e}", file=sys.stderr)
        return None, None
        
    script_dir = os.path.dirname(os.path.abspath(__file__))
    captcha_path = os.path.join(script_dir, "captcha.png")
    with open(captcha_path, "wb") as f:
        f.write(captcha_res.content)
        
    print(f"\n=======================================================")
    print(f"【驗證碼已儲存】已將驗證碼圖片存至您的本機目錄：")
    print(f"👉 {captcha_path}")
    print(f"請使用圖片檢視器打開它以查看 4 位數驗證碼。")
    print(f"=======================================================\n")
    
    return session, csrf_token

def perform_search(session, csrf_token, readrang, testing, keywords, captcha_code):
    """
    發送 POST 搜尋請求以設定伺服器 Session 中的搜尋過濾條件
    """
    base_url = "https://read.chc.edu.tw/index.php"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    post_url = f"{base_url}?inter=books&page=1&kind=cht&search=1"
    data = {
        "csrf_token": csrf_token,
        "inter": "books",
        "field": "title",
        "readrang": readrang,
        "testing": testing,
        "keywords": keywords,
        "captcha_code": captcha_code,
        "search_act": "search"
    }
    
    print("3. 正在送出搜尋條件與驗證碼...")
    try:
        response = session.post(post_url, data=data, headers=headers, verify=False, timeout=15)
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"發送搜尋請求失敗：{e}", file=sys.stderr)
        return False
        
    # 檢查是否彈出驗證碼錯誤的 JavaScript 警告
    soup = BeautifulSoup(response.text, "html.parser")
    script_tags = soup.find_all("script")
    for s in script_tags:
        if s.string and "alert" in s.string:
            # 取得警告內容，例如 "請輸入驗證碼" 或 "驗證碼錯誤"
            alert_text = s.string.strip()
            print(f"\n❌ 搜尋被拒絕，伺服器訊息：{alert_text}", file=sys.stderr)
            return False

    return True

def fetch_books_by_page(session, page_number):
    """
    使用已搜尋認證的 Session 抓取指定頁數的書籍資料
    """
    base_url = "https://read.chc.edu.tw/index.php"
    params = {
        "inter": "books",
        "kind": "cht",
        "search": "1",
        "page": str(page_number)
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        response = session.get(base_url, params=params, headers=headers, verify=False, timeout=15)
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"抓取第 {page_number} 頁失敗：{e}", file=sys.stderr)
        return None
        
    soup = BeautifulSoup(response.text, "html.parser")
    book_elements = soup.select("div.book-group")
    page_text = soup.get_text(" ", strip=True)
    if not book_elements and not any(
        marker in page_text for marker in ("查無", "無符合", "0 筆")
    ):
        raise SourceStructureError(
            f"推薦書單第 {page_number} 頁缺少預期的書目區塊或查無結果標記"
        )
    
    books = []
    for elem in book_elements:
        book_data = {}
        
        # 1. 取得詳細頁面連結
        a_tag = elem.find("a")
        if a_tag and "href" in a_tag.attrs:
            relative_url = a_tag["href"]
            book_data["url"] = urllib.parse.urljoin(base_url, relative_url)
        else:
            book_data["url"] = ""
            
        # 2. 取得書名
        h3_tag = elem.find("h3")
        if h3_tag:
            book_data["title"] = h3_tag.get_text(strip=True)
        else:
            continue  # 若無書名則跳過
            
        # 3. 取得詳細屬性
        book_text_div = elem.find("div", class_="book-text")
        if book_text_div:
            p_tags = book_text_div.find_all("p")
            for p in p_tags:
                text = p.get_text(strip=True)
                if text.startswith("作者："):
                    book_data["author"] = text.replace("作者：", "").strip()
                elif text.startswith("出版社："):
                    book_data["publisher"] = text.replace("出版社：", "").strip()
                elif text.startswith("適讀年段："):
                    book_data["range"] = text.replace("適讀年段：", "").strip()
                    
            # 認證狀態
            status_span = book_text_div.find("span")
            if status_span:
                book_data["status"] = status_span.get_text(strip=True)
            else:
                book_data["status"] = "未知"
        else:
            book_data["author"] = ""
            book_data["publisher"] = ""
            book_data["range"] = ""
            book_data["status"] = ""
            
        books.append(book_data)

    if book_elements and not books:
        raise SourceStructureError(
            f"推薦書單第 {page_number} 頁有結果區塊，但無法解析任何書名"
        )

    return books

def save_to_html(books, page_number, readrang_name, testing_name, keywords):
    """
    將書籍清單存入 HTML 檔案
    """
    if not books:
        print(f"\n第 {page_number} 頁沒有任何書籍資料，不進行儲存。")
        return None
        
    filename = f"books_page_{page_number}.html"
    script_dir = os.path.dirname(os.path.abspath(__file__))
    filepath = os.path.join(script_dir, filename)
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("<!DOCTYPE html>\n")
        f.write('<html lang="zh-TW">\n')
        f.write('<head>\n')
        f.write('    <meta charset="UTF-8">\n')
        f.write('    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n')
        f.write(f'    <title>書籍清單 - 第 {page_number} 頁</title>\n')
        f.write('    <style>\n')
        f.write('        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 15px; line-height: 1.6; max-width: 1200px; margin: 0 auto; background-color: #f8f9fa; color: #333; }\n')
        f.write('        h1 { color: #2c3e50; font-size: 1.8rem; margin-bottom: 15px; text-align: center; }\n')
        f.write('        .info { background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 20px; border-left: 5px solid #007bff; }\n')
        f.write('        .info p { margin: 5px 0; font-size: 0.95rem; }\n')
        f.write('        table { width: 100%; border-collapse: collapse; margin-top: 15px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }\n')
        f.write('        th, td { padding: 12px 10px; text-align: left; border-bottom: 1px solid #eee; font-size: 0.9rem; }\n')
        f.write('        th { background-color: #007bff; color: white; font-weight: 600; }\n')
        f.write('        tr:hover { background-color: #f8f9fa; }\n')
        f.write('        a { color: #0056b3; text-decoration: none; font-weight: 600; word-break: break-all; }\n')
        f.write('        a:hover { text-decoration: underline; color: #003d80; }\n')
        f.write('        .status { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; }\n')
        f.write('        .status-yes { background-color: #d4edda; color: #155724; }\n')
        f.write('        .status-no { background-color: #f8d7da; color: #721c24; }\n')
        f.write('        /* 針對手機裝置的排版優化 */\n')
        f.write('        @media screen and (max-width: 600px) {\n')
        f.write('            table, thead, tbody, th, td, tr { display: block; }\n')
        f.write('            thead tr { position: absolute; top: -9999px; left: -9999px; }\n')
        f.write('            tr { border: 1px solid #ccc; margin-bottom: 10px; border-radius: 8px; padding: 8px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }\n')
        f.write('            td { border: none; border-bottom: 1px solid #eee; position: relative; padding-left: 35%; text-align: left; white-space: normal; }\n')
        f.write('            td:last-child { border-bottom: none; }\n')
        f.write('            td:before { position: absolute; top: 12px; left: 10px; width: 30%; padding-right: 10px; white-space: nowrap; font-weight: bold; color: #666; content: attr(data-label); }\n')
        f.write('        }\n')
        f.write('    </style>\n')
        f.write('</head>\n')
        f.write('<body>\n')
        f.write(f'    <h1>群書博覽 - 中書籍清單 (第 {page_number} 頁)</h1>\n')
        f.write('    <div class="info">\n')
        f.write(f'        <p><strong>適讀年段：</strong>{readrang_name}</p>\n')
        f.write(f'        <p><strong>認證狀態：</strong>{testing_name}</p>\n')
        if keywords:
            f.write(f'        <p><strong>關鍵字：</strong>{keywords}</p>\n')
        f.write(f'        <p><strong>資料來源：</strong><a href="https://read.chc.edu.tw/index.php?inter=books&kind=cht&search=1&page={page_number}" target="_blank">讀步彰化飛閱雲端 閱讀線上認證系統</a></p>\n')
        f.write('    </div>\n')
        f.write('    <table>\n')
        f.write('        <thead>\n')
        f.write('            <tr>\n')
        f.write('                <th>序號</th>\n')
        f.write('                <th>書名</th>\n')
        f.write('                <th>作者</th>\n')
        f.write('                <th>出版社</th>\n')
        f.write('                <th>適讀年段</th>\n')
        f.write('                <th>認證狀態</th>\n')
        f.write('            </tr>\n')
        f.write('        </thead>\n')
        f.write('        <tbody>\n')
        
        for i, book in enumerate(books, 1):
            title = book.get("title", "")
            author = book.get("author", "")
            publisher = book.get("publisher", "")
            readers_range = book.get("range", "")
            status = book.get("status", "")
            url = book.get("url", "")
            
            title_html = f'<a href="{url}" target="_blank">{title}</a>' if url else title
            status_class = 'status status-yes' if '可' in status else 'status status-no'
            
            f.write('            <tr>\n')
            f.write(f'                <td data-label="序號">{i}</td>\n')
            f.write(f'                <td data-label="書名">{title_html}</td>\n')
            f.write(f'                <td data-label="作者">{author}</td>\n')
            f.write(f'                <td data-label="出版社">{publisher}</td>\n')
            f.write(f'                <td data-label="適讀年段">{readers_range}</td>\n')
            f.write(f'                <td data-label="認證狀態"><span class="{status_class}">{status}</span></td>\n')
            f.write('            </tr>\n')
            
        f.write('        </tbody>\n')
        f.write('    </table>\n')
        f.write('</body>\n')
        f.write('</html>\n')
        
    print(f"\n🎉 成功將第 {page_number} 頁的書籍儲存至：\n👉 {filepath}")
    return filepath

def main():
    # 強制主控台輸出為 UTF-8 (特別在 Windows 上)
    sys.stdout.reconfigure(encoding='utf-8')
    
    print("=======================================================")
    print(" 讀步彰化飛閱雲端 - 書籍清單下載爬蟲")
    print("=======================================================\n")
    
    # 選擇年段（支援複選）
    print("【1】請選擇適讀年段 (可複選，請以空格隔開，例如：1 2)：")
    print(" 0. 全部年段 (預設)")
    print(" 1. 國小低年級")
    print(" 2. 國小中年級")
    print(" 3. 國小高年級")
    print(" 4. 國中")
    print(" 5. 其他")
    rang_input = input("請選擇 (0-5，可複選)：").strip()
    
    readrang_map = {
        "1": "國小低年級",
        "2": "國小中年級",
        "3": "國小高年級",
        "4": "國中",
        "5": "其他"
    }

    # 解析使用者輸入的年段選項
    raw_choices = [c for c in re.split(r'[\s,]+', rang_input) if c]
    valid_choices = [c for c in raw_choices if c in readrang_map]

    # 判斷是否為全部年段 (未輸入、包含 0、無有效選項或全選)
    if not raw_choices or "0" in raw_choices or len(valid_choices) == 0 or len(valid_choices) == len(readrang_map):
        server_readrang = "all"
        selected_range_names = None
        readrang_display_name = "全部年段"
    elif len(valid_choices) == 1:
        server_readrang = valid_choices[0]
        selected_range_names = {readrang_map[valid_choices[0]]}
        readrang_display_name = readrang_map[valid_choices[0]]
    else:
        server_readrang = "all"
        selected_range_names = {readrang_map[c] for c in valid_choices}
        readrang_display_name = "、".join([readrang_map[c] for c in valid_choices])
    
    # 選擇認證狀態
    print("\n【2】請選擇認證狀態：")
    print(" 0. 全部書籍 (預設)")
    print(" 1. 可認證")
    print(" 2. 不可認證")
    test_choice = input("請選擇 (0-2)：").strip()
    
    testing_map = {
        "0": "all",
        "1": "1",
        "2": "2"
    }
    testing_names = {
        "all": "全部書籍",
        "1": "可認證",
        "2": "不可認證"
    }
    testing = testing_map.get(test_choice, "all")
    testing_name = testing_names[testing]
    
    # 關鍵字
    keywords = input("\n【3】請輸入書籍關鍵字 (選填，直接按 Enter 跳過)：").strip()
    
    # 獲取 Session 與 CSRF Token 並下載驗證碼
    session, csrf_token = fetch_search_session()
    if not session:
        sys.exit(1)
        
    # 輸入驗證碼
    captcha_code = input("請輸入 4 位數驗證碼：").strip()
    
    # 執行搜尋
    success = perform_search(session, csrf_token, server_readrang, testing, keywords, captcha_code)
    if not success:
        print("\n❌ 搜尋初始化失敗，程式結束。請確認驗證碼是否輸入正確，然後重新執行程式。")
        sys.exit(1)
        
    print("\n✅ 搜尋初始化成功！已成功套用您的篩選條件。")
    
    # 迴圈讓使用者抓取多個頁碼或範圍
    while True:
        page_input = input("\n請輸入要下載的頁碼或範圍 (例如：1 或 1-5，輸入 q 退出)：").strip()
        if page_input.lower() == 'q':
            print("感謝使用！程式已結束。")
            break
            
        pages_to_fetch = []
        try:
            if '-' in page_input:
                start, end = map(int, page_input.split('-'))
                if start <= 0 or end < start:
                    raise ValueError
                pages_to_fetch = list(range(start, end + 1))
            else:
                page_number = int(page_input)
                if page_number <= 0:
                    raise ValueError
                pages_to_fetch = [page_number]
        except ValueError:
            print("請輸入有效的頁碼格式 (正整數，例如 1 或 1-5)！")
            continue
            
        import time
        for page_number in pages_to_fetch:
            print(f"正在抓取第 {page_number} 頁...")
            try:
                books = fetch_books_by_page(session, page_number)
            except SourceStructureError as exc:
                print(f"來源格式異常：{exc}", file=sys.stderr)
                continue
            if books:
                # 若為複選年段，在本地端進行聯集過濾
                if selected_range_names:
                    books = [b for b in books if b.get("range", "").strip() in selected_range_names]
    
                if books:
                    save_to_html(books, page_number, readrang_display_name, testing_name, keywords)
                else:
                    print(f"\n第 {page_number} 頁抓取到的書籍中，沒有符合選擇年段 ({readrang_display_name}) 的項目。")
                # 在抓取成功後，刪除暫存的驗證碼圖片檔案
                captcha_path = os.path.join(os.getcwd(), "captcha.png")
                if os.path.exists(captcha_path):
                    try:
                        os.remove(captcha_path)
                    except Exception:
                        pass
            else:
                print(f"抓取第 {page_number} 頁失敗。可能該頁面超出範圍，或者連線已逾期。")
                break # 失敗可能是超出最大頁數，因此中斷該範圍的後續下載
            
            # 若為範圍下載，加入短暫延遲避免請求過於密集
            if len(pages_to_fetch) > 1 and page_number != pages_to_fetch[-1]:
                time.sleep(1)

if __name__ == "__main__":
    main()
