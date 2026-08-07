# 📚 彰化閱讀線上認證書籍查詢系統 (PWA)

這是一個專為手機與行動裝置設計的「彰化閱讀線上認證系統」書籍查詢工具。它支援**模糊文字搜尋**、**語音輸入搜尋**、**適讀年級/認證狀態篩選**，以及**拍照/上傳照片自動辨識 (OCR)** 繁體中文書名功能。本專案符合 PWA 標準，可離線操作並安裝至手機主畫面。

---

## 🛠️ 專案目錄結構

- `crawler.py` - 自動爬取「彰化閱讀線上認證系統」網站上的書籍清單 HTML 檔案。
- `crawler.bat` - Windows 環境下快速執行爬蟲的批次檔。
- `requirements.txt` - Python 爬蟲執行所需的套件清單。
- `parse_books.py` - 用於讀取爬取下來的 HTML 頁面並將其解析為單一 JSON 資料庫的 Python 腳本。
- `books.json` - 解析後的結構化書籍資料庫。
- `index.html` - 網頁應用程式主介面。
- `app.js` - 前端邏輯核心（包含模糊搜尋、相機拍照、上傳檔案以及 OCR API 串接）。
- `style.css` - 現代化毛玻璃質感（Glassmorphism）與深淺主題的樣式設定。
- `manifest.json` - PWA 應用程式設定檔（提供「新增至主畫面」功能）。
- `sw.js` - Service Worker 快取腳本（實現無網路離線查詢）。
- `icon.svg` - 應用程式圖示。

---

## 🚀 操作說明與使用步驟

### 步驟一：執行爬蟲與解析資料，更新書籍資料庫

本系統的書籍資料來源是透過自動爬蟲抓取目標網站的資料。
若要更新最新書單，請在本機執行以下步驟：

1. 開啟終端機並切換至此專案目錄。
2. (建議) 建立 Python 虛擬環境，並安裝必要套件：
   ```bash
   pip install -r requirements.txt
   ```
3. 執行爬蟲腳本抓取最新的書籍資料頁面：
   ```bash
   python crawler.py
   ```
   > 提示：在 Windows 下，也可以直接點擊 `crawler.bat` 執行（若您已建立 `.venv` 虛擬環境）。
   執行後，目錄下將會自動下載 `books_page_1.html` 等分頁檔案。
4. 執行解析腳本，將 HTML 轉換為可供 App 使用的 JSON 格式：
   ```bash
   python parse_books.py
   ```
   執行後會更新產出 `books.json`。

### 步驟二：本地測試與預覽

如果您想在本機進行預覽或測試相機拍照辨識功能：

1. 啟動一個本地網頁伺服器（因相機功能與 Service Worker 在安全考量下需於 `http://localhost` 或 `https` 協定執行）：
   ```bash
   python -m http.server 8000
   ```
2. 開啟瀏覽器訪問：`http://localhost:8000`

### 步驟三：手機安裝與部署 (GitHub Pages)

本專案可以直接發佈至免費的 **GitHub Pages** 上：

1. 將本專案程式碼推送到 GitHub 儲存庫。
2. 在該 Repository 的 Settings -> Pages 中開啟部署功能。
3. 使用手機開啟部署完成的 `https://<您的帳號>.github.io/<儲存庫名稱>/` 網址。

#### 📱 如何在手機上「安裝為 App」？
- **iOS (Safari)**：點選下方的「分享」按鈕，選擇「**加入主畫面**」。
- **Android (Chrome)**：點選右上角選單，選擇「**安裝應用程式**」或「**新增至主畫面**」。

---

## 📷 拍照辨識功能 (OCR) 說明

本系統已支援 **Google AI Studio (Gemini 2.5 Flash)** 提供最強大的繁體中文辨識能力：

- **API 金鑰設定**：點擊網頁右上角的「⚙️ 設定」按鈕，輸入您的 Google AI Studio 金鑰。金鑰可至 [Google AI Studio](https://aistudio.google.com/app/apikey) 免費申請。您的金鑰僅會安全地儲存於手機瀏覽器本地（localStorage），不會上傳至任何第三方伺服器。
- **拍攝技巧**：點擊「拍照辨識」後，畫面會出現綠色的對焦掃描框。請將**書名**對準並儘可能填滿該對焦框後點擊拍攝。系統會自動擷取對焦框內的部分進行高精度辨識，避免周邊雜訊干擾。
- **清除功能**：點擊搜尋框右側的 `×` 即可快速清空輸入內容並還原全部書籍清單。
