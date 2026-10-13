(function (global) {
  "use strict";

  const EDITION_NOTE_PATTERN = /[（(【\[][^）)】\]]*(?:新版|修訂|注音|典藏|紀念|增訂|改版|彩色)[^）)】\]]*[）)】\]]/g;
  const EDITION_SUFFIX_PATTERN = /(?:全新|修訂|增訂|改訂|典藏|紀念|注音|彩色|新)版$/;

  /**
   * 將只有排版、常見字形或版本註記差異的書名歸到同一組。
   * 刻意不使用寬鬆的模糊比對，以免把同系列但內容不同的書誤判成同一本。
   */
  function normalizeSimilarTitle(title) {
    return String(title || "")
      .normalize("NFKC")
      .toLocaleLowerCase("zh-TW")
      .replace(/臺/g, "台")
      .replace(EDITION_NOTE_PATTERN, "")
      .replace(/[\s\p{P}\p{S}]/gu, "")
      .replace(EDITION_SUFFIX_PATTERN, "");
  }

  function preferredLabel(books) {
    const titleCounts = new Map();
    books.forEach((book) => {
      const title = String(book.title || "").trim();
      if (title) titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
    });

    return [...titleCounts.entries()]
      .sort((left, right) => {
        return right[1] - left[1]
          || left[0].length - right[0].length
          || left[0].localeCompare(right[0], "zh-Hant");
      })[0]?.[0] || "未命名書籍";
  }

  function buildSimilarTitleGroups(books) {
    const booksByKey = new Map();

    books.forEach((book) => {
      const key = normalizeSimilarTitle(book.title);
      if (!key) return;
      if (!booksByKey.has(key)) booksByKey.set(key, []);
      booksByKey.get(key).push(book);
    });

    return [...booksByKey.entries()]
      .filter(([, groupBooks]) => groupBooks.length > 1)
      .map(([key, groupBooks]) => ({
        key,
        label: preferredLabel(groupBooks),
        count: groupBooks.length
      }))
      .sort((left, right) => left.label.localeCompare(right.label, "zh-Hant"));
  }

  const api = { normalizeSimilarTitle, buildSimilarTitleGroups };
  global.ReadingFinderTitleGroups = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
