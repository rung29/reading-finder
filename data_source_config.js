// 僅包含公開的 Supabase Storage URL，切勿在此檔案存放敏感金鑰。
window.READING_FINDER_DATA_CONFIG = {
  supabasePublicBaseUrl: "https://olbglokwiibzxpsyxiup.supabase.co/storage/v1/object/public/book-data",
  // 更新書單時一併調整版本，讓瀏覽器不會沿用舊的 books.json。
  booksVersion: "2026-10-13",
  timeoutMs: 5000,
  noticeDurationMs: 3000,
};
