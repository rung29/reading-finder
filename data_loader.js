(function (global) {
  "use strict";

  const config = global.READING_FINDER_DATA_CONFIG || {};
  const timeoutMs = Number(config.timeoutMs) || 5000;
  const noticeDurationMs = Number(config.noticeDurationMs) || 3000;
  let noticeTimer = null;

  function configuredSupabaseBaseUrl() {
    const value = String(config.supabasePublicBaseUrl || "").trim();
    if (!value || value.includes("YOUR_PROJECT_REF")) {
      return "";
    }
    return value.replace(/\/+$/, "");
  }

  function cacheBusted(url) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${Date.now()}`;
  }

  async function fetchJson(url, isCloud = false) {
    const controller = new AbortController();
    const timer = global.setTimeout(() => controller.abort(), timeoutMs);
    try {
      // 雲端請求一律加 cache-busting 且 no-store 以確保取得最新內容
      // 本機請求則允許由 Service Worker 快取處理以支援離線模式
      const fetchOptions = isCloud
        ? { cache: "no-store", signal: controller.signal }
        : { signal: controller.signal };

      const response = await fetch(isCloud ? cacheBusted(url) : url, fetchOptions);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("JSON 根節點不是陣列");
      }
      return data;
    } finally {
      global.clearTimeout(timer);
    }
  }

  function showSourceNotice(message, isFallback) {
    let notice = document.getElementById("data-source-notice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "data-source-notice";
      notice.setAttribute("role", "status");
      notice.setAttribute("aria-live", "polite");
      notice.style.cssText = [
        "position:fixed",
        "top:16px",
        "left:50%",
        "z-index:9999",
        "max-width:calc(100vw - 32px)",
        "padding:10px 18px",
        "border-radius:999px",
        "font:600 13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
        "box-shadow:0 8px 24px rgba(0,0,0,.35)",
        "transform:translate(-50%,-16px)",
        "opacity:0",
        "transition:opacity .25s ease,transform .25s ease",
        "pointer-events:none",
      ].join(";");
      document.body.appendChild(notice);
    }

    notice.textContent = message;
    if (isFallback) {
      notice.style.background = "linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(217, 119, 6, 0.95))";
      notice.style.color = "#ffffff";
      notice.style.border = "1px solid rgba(255, 255, 255, 0.3)";
    } else {
      notice.style.background = "linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))";
      notice.style.color = "#ffffff";
      notice.style.border = "1px solid rgba(255, 255, 255, 0.3)";
    }

    global.clearTimeout(noticeTimer);
    global.requestAnimationFrame(() => {
      notice.style.opacity = "1";
      notice.style.transform = "translate(-50%,0)";
    });
    noticeTimer = global.setTimeout(() => {
      notice.style.opacity = "0";
      notice.style.transform = "translate(-50%,-16px)";
    }, noticeDurationMs);
  }

  async function load(fileName) {
    const supabaseBaseUrl = configuredSupabaseBaseUrl();
    if (supabaseBaseUrl) {
      try {
        const cloudUrl = `${supabaseBaseUrl}/${fileName}`;
        const data = await fetchJson(cloudUrl, true);
        showSourceNotice("☁️ 資料來源：Supabase 雲端最新", false);
        return { data, source: "supabase" };
      } catch (error) {
        console.warn(`Supabase ${fileName} 讀取失敗，改用本地快取備援。`, error);
      }
    }

    try {
      const data = await fetchJson(fileName, false);
      showSourceNotice(
        supabaseBaseUrl
          ? "⚠️ Supabase 連線逾時或失敗，已切換至本機備援"
          : "📱 資料來源：本機資料庫",
        true
      );
      return { data, source: "local" };
    } catch (error) {
      throw new Error(`雲端與本機皆無法讀取 ${fileName}`, { cause: error });
    }
  }

  global.ReadingFinderDataLoader = { load };
})(window);
