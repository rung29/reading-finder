// 全局狀態變數
let booksData = [];
let filteredBooks = [];
let fuseInstance = null;
let currentPage = 1;
let pageSize = 20; // 預設每頁顯示 20 筆
let videoStream = null;

// DOM 元素引用
const searchInput = document.getElementById('search-input');
const clearBtn = document.getElementById('clear-btn');
const micBtn = document.getElementById('mic-btn');
const filterAge = document.getElementById('filter-age');
const filterCertified = document.getElementById('filter-certified');
const displayMode = document.getElementById('display-mode');
const resultsCount = document.getElementById('results-count');
const bookListContainer = document.getElementById('book-list');
const themeToggle = document.getElementById('theme-toggle');
const offlineBanner = document.getElementById('offline-banner');

// OCR 與相機相關元素
const scanBtn = document.getElementById('scan-btn');
const fileInput = document.getElementById('file-input');
const cameraSection = document.getElementById('camera-section');
const videoPreview = document.getElementById('video-preview');
const captureCanvas = document.getElementById('capture-canvas');
const captureBtn = document.getElementById('capture-btn');
const cancelCameraBtn = document.getElementById('cancel-camera-btn');

// 分頁元素
const paginationContainer = document.getElementById('pagination-container');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const paginationInfo = document.getElementById('pagination-info');

// 提示框 (Toast) 元素
const toastElement = document.getElementById('toast');
const toastText = document.getElementById('toast-text');

// 設定彈窗元素
const openSettingsBtn = document.getElementById('open-settings-btn');
const settingsModal = document.getElementById('settings-modal');
const apiKeyInput = document.getElementById('api-key-input');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');

// API Key 在 localStorage 中的儲存鍵名
const API_KEY_STORAGE_KEY = 'vision_api_key';

// 1. 初始化載入書籍資料
async function init() {
  showToast('正在載入書籍資料庫...');
  try {
    const response = await fetch('books.json');
    if (!response.ok) throw new Error('無法讀取 books.json');
    booksData = await response.json();

    // 初始化 Fuse.js 模糊搜尋引擎
    const options = {
      keys: [
        { name: 'title', weight: 0.6 },
        { name: 'author', weight: 0.2 },
        { name: 'publisher', weight: 0.2 }
      ],
      threshold: 0.4, // 模糊度匹配閥值 (0.0 精確比對，1.0 匹配所有)
      ignoreLocation: true
    };
    fuseInstance = new Fuse(booksData, options);

    // 預設載入全部書籍並渲染
    applyFiltersAndSearch();
    showToast(`成功載入 ${booksData.length} 本書籍！`, 'success');
  } catch (error) {
    console.error('初始化失敗:', error);
    showToast('書籍資料載入失敗，請確認網路連線。', 'error');
  }
}

// 2. 顯示 Toast 訊息
function showToast(message, type = 'info') {
  toastText.textContent = message;
  toastElement.className = `toast show ${type}`;
  setTimeout(() => {
    toastElement.classList.remove('show');
  }, 3500);
}

// 3. 處理搜尋與篩選邏輯
function applyFiltersAndSearch() {
  const query = searchInput.value.trim();
  const ageFilter = filterAge.value;
  const certifiedFilter = filterCertified.value;

  // 顯示清除按鈕
  clearBtn.style.display = query ? 'block' : 'none';

  // 第一階段：模糊搜尋或返回全部
  let results = [];
  if (query && fuseInstance) {
    const fuseResults = fuseInstance.search(query);
    results = fuseResults.map(r => r.item);
  } else {
    results = [...booksData];
  }

  // 第二階段：適讀年段篩選
  if (ageFilter) {
    results = results.filter(book => book.age_group.includes(ageFilter));
  }

  // 第三階段：認證狀態篩選
  if (certifiedFilter !== "") {
    const isCertified = certifiedFilter === "true";
    results = results.filter(book => book.certified === isCertified);
  }

  filteredBooks = results;
  currentPage = 1; // 搜尋重設為第一頁
  renderResults();
}

// 4. 渲染書籍卡片清單與分頁
function renderResults() {
  bookListContainer.innerHTML = '';

  // 顯示當前搜尋筆數
  resultsCount.innerHTML = `共有 <strong>${filteredBooks.length}</strong> 本書籍`;

  if (filteredBooks.length === 0) {
    bookListContainer.innerHTML = `<div class="glass-card" style="text-align:center; padding:30px; color:var(--text-secondary);">查無符合搜尋條件的書籍 🔍</div>`;
    paginationContainer.classList.add('hidden');
    return;
  }

  // 取得分頁顯示設定
  const mode = displayMode.value;
  let renderData = [];

  if (mode === 'all') {
    renderData = filteredBooks;
    paginationContainer.classList.add('hidden');
  } else {
    pageSize = parseInt(mode, 10);
    const totalPages = Math.ceil(filteredBooks.length / pageSize);

    // 邊界條件處理
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * pageSize;
    renderData = filteredBooks.slice(startIdx, startIdx + pageSize);

    // 更新分頁控制項
    paginationContainer.classList.remove('hidden');
    paginationInfo.textContent = `第 ${currentPage} / ${totalPages} 頁`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
  }

  // 生成書籍卡片並加入容器
  renderData.forEach(book => {
    const card = document.createElement('div');
    card.className = 'book-card';

    const titleHtml = book.link
      ? `<a href="${book.link}" target="_blank" class="book-title">${book.title}</a>`
      : `<span class="book-title">${book.title}</span>`;

    const badgeClass = book.certified ? 'badge-success' : 'badge-danger';
    const badgeText = book.certified ? '可認證' : '不可認證';

    card.innerHTML = `
      <div class="book-header">
        ${titleHtml}
        <span class="badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="book-details">
        <div class="detail-item"><strong>作者：</strong>${book.author || '未知'}</div>
        <div class="detail-item"><strong>適讀：</strong>${book.age_group}</div>
        <div class="detail-item" style="grid-column: span 2;"><strong>出版社：</strong>${book.publisher || '無'}</div>
      </div>
    `;
    bookListContainer.appendChild(card);
  });
}

// ============================================================
// 5. Google Cloud Vision API OCR 辨識功能
// ============================================================

// 從 localStorage 取得已儲存的 API Key
function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
}

// 檢查 API Key 是否已設定，若無則提示使用者
function ensureApiKey() {
  const key = getApiKey();
  if (!key) {
    showToast('請先點擊右上角 ⚙️ 設定 Google Cloud API 金鑰。', 'error');
    settingsModal.classList.remove('hidden');
    return false;
  }
  return true;
}

// 拍照辨識相機啟動
async function startCamera() {
  // 先確認有設定 API Key
  if (!ensureApiKey()) return;

  cameraSection.style.display = 'flex';
  scanBtn.disabled = true;

  try {
    const constraints = {
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    };
    videoStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoPreview.srcObject = videoStream;
  } catch (err) {
    console.error('無法啟動相機:', err);
    showToast('無法啟動相機，請嘗試上傳照片或檢查權限。', 'error');
    stopCamera();
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  videoPreview.srcObject = null;
  cameraSection.style.display = 'none';
  scanBtn.disabled = false;
}

// 拍照擷取後呼叫 Vision API
captureBtn.addEventListener('click', () => {
  if (!videoStream) return;

  const width = videoPreview.videoWidth;
  const height = videoPreview.videoHeight;
  captureCanvas.width = width;
  captureCanvas.height = height;

  const ctx = captureCanvas.getContext('2d');
  ctx.drawImage(videoPreview, 0, 0, width, height);

  // 為了提高辨識率，僅裁剪中間綠色框範圍進行 OCR
  const cropX = width * 0.1;
  const cropY = height * 0.3;
  const cropW = width * 0.8;
  const cropH = height * 0.4;

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  const cropCtx = cropCanvas.getContext('2d');
  cropCtx.drawImage(captureCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  stopCamera();
  processImageWithGemini(cropCanvas);
});

// 上傳圖片後呼叫 Vision API
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // 先確認有設定 API Key
  if (!ensureApiKey()) {
    fileInput.value = ''; // 清空選取
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      // 將圖片繪製到 Canvas，方便後續轉為 base64
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      processImageWithGemini(canvas);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

// 使用 Gemini API 進行繁體中文 OCR 辨識
async function processImageWithGemini(canvasSource) {
  const apiKey = getApiKey();
  if (!apiKey) {
    showToast('請先設定 Gemini API 金鑰。', 'error');
    return;
  }

  showToast('正在使用 Gemini API 辨識書名...', 'info');

  try {
    // 將 Canvas 轉為 base64 編碼的 JPEG 格式，Gemini API 需要純 Base64 字串（無前綴）
    const base64Image = canvasSource.toDataURL('image/jpeg', 0.85).split(',')[1];

    const requestBody = {
      contents: [{
        parts: [
          {
            text: `請辨識這張圖片中的繁體中文文字：
              1. 若圖片是一本書或書籍封面，請直接提取「書名」即可（不用回覆作者、出版社或對話）。
  2. 若圖片是一般文字（如手寫字、標語），請直接輸出辨識到的文字。
  3. 若完全辨識不到任何文字，請回覆空字串。`
          },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: base64Image
            }
          }
        ]
      }]
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `HTTP ${response.status}`;
      throw new Error(errMsg);
    }

    const data = await response.json();
    const fullText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // 清理辨識結果中的雜訊與換行
    const cleanedText = fullText
      .replace(/[^\u4e00-\u9fff0-9a-zA-Z\u3000-\u303f\uff00-\uffef]/g, ' ') // 保留中英文、數字與全形標點
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanedText) {
      // 擷取前幾個文字作為書名查詢詞
      const searchKeyword = cleanedText.slice(0, 15).trim();
      searchInput.value = searchKeyword;
      showToast(`辨識成功: "${searchKeyword}"`, 'success');
      applyFiltersAndSearch();
    } else {
      showToast('未能辨識出文字，請重新拍照或調整對焦。', 'error');
    }
  } catch (error) {
    console.error('Gemini API 辨識錯誤:', error);
    if (error.message.includes('API key') || error.message.includes('API_KEY_INVALID')) {
      showToast('API 金鑰無效，請至設定中確認。', 'error');
    } else {
      showToast(`辨識失敗: ${error.message}`, 'error');
    }
  }
}

// ============================================================
// 6. 設定面板 (API Key 管理)
// ============================================================

// 開啟設定彈窗
openSettingsBtn.addEventListener('click', () => {
  apiKeyInput.value = getApiKey();
  settingsModal.classList.remove('hidden');
});

// 儲存 API Key
saveSettingsBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (key) {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
    showToast('API 金鑰已成功儲存！', 'success');
  } else {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    showToast('已清除 API 金鑰。', 'info');
  }
  settingsModal.classList.add('hidden');
});

// 關閉設定彈窗
closeSettingsBtn.addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

// 點擊遮罩層關閉彈窗
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.add('hidden');
  }
});

// ============================================================
// 7. 事件綁定
// ============================================================

searchInput.addEventListener('input', applyFiltersAndSearch);
clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  applyFiltersAndSearch();
  searchInput.focus();
});

// 語音辨識 (Web Speech API)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = 'zh-TW';
  recognition.continuous = false;
  recognition.interimResults = false;
  let isRecording = false;

  micBtn.addEventListener('click', () => {
    if (isRecording) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
      isRecording = true;
      micBtn.classList.add('recording');
      showToast('🎤 請說出書名...', 'info');
    } catch (e) {
      showToast('語音辨識啟動失敗，請稍後再試。', 'error');
    }
  });

  recognition.addEventListener('result', (event) => {
    const transcript = event.results[0][0].transcript;
    searchInput.value = transcript;
    applyFiltersAndSearch();
    showToast(`聽到: "${transcript}"`, 'success');
  });

  recognition.addEventListener('end', () => {
    isRecording = false;
    micBtn.classList.remove('recording');
  });

  recognition.addEventListener('error', (event) => {
    isRecording = false;
    micBtn.classList.remove('recording');
    const errorMap = {
      'not-allowed': '麥克風權限被拒，請允許瀏覽器使用麥克風。',
      'no-speech': '', // 沒說話不提示
      'network': '語音辨識需要網路連線，請檢查連線狀態。',
      'audio-capture': '找不到麥克風裝置，請確認麥克風是否已連接。',
      'service-not-allowed': '語音辨識服務不可用，請確認瀏覽器支援狀況。'
    };
    const msg = errorMap[event.error];
    if (msg) showToast(msg, 'error');
  });
} else {
  // 若瀏覽器不支援則隱藏麥克風按鈕
  micBtn.style.display = 'none';
}

filterAge.addEventListener('change', applyFiltersAndSearch);
filterCertified.addEventListener('change', applyFiltersAndSearch);
displayMode.addEventListener('change', () => {
  currentPage = 1;
  renderResults();
});

// 分頁點擊事件
prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    renderResults();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

nextPageBtn.addEventListener('click', () => {
  const totalPages = Math.ceil(filteredBooks.length / pageSize);
  if (currentPage < totalPages) {
    currentPage++;
    renderResults();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

// 相機開啟與關閉按鈕
scanBtn.addEventListener('click', startCamera);
cancelCameraBtn.addEventListener('click', stopCamera);

// 8. 深色主題切換
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'light') {
    document.documentElement.removeAttribute('data-theme');
    themeToggle.textContent = '☀️';
  } else if (savedTheme === 'dark' || systemPrefersDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.textContent = '🌙';
  } else {
    document.documentElement.removeAttribute('data-theme');
    themeToggle.textContent = '☀️';
  }
}

themeToggle.addEventListener('click', () => {
  const isDark = document.documentElement.hasAttribute('data-theme');
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
    themeToggle.textContent = '☀️';
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    themeToggle.textContent = '🌙';
  }
});

// 9. 偵測離線狀態
window.addEventListener('online', () => {
  offlineBanner.style.display = 'none';
});
window.addEventListener('offline', () => {
  offlineBanner.style.display = 'block';
});

if (!navigator.onLine) {
  offlineBanner.style.display = 'block';
}

// 10. 註冊 PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker 註冊成功', reg.scope))
      .catch(err => console.warn('Service Worker 註冊失敗', err));
  });
}

// 執行載入與初始化
initTheme();
init();
