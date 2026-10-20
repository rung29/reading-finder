(function (global) {
  "use strict";

  const EDITION_NOTE_PATTERN = /[（(【\[][^）)】\]]*(?:新版|修訂|注音|典藏|紀念|增訂|改版|彩色)[^）)】\]]*[）)】\]]/g;
  const EDITION_SUFFIX_PATTERN = /(?:全新|修訂|增訂|改訂|典藏|紀念|注音|彩色|新)版$/;
  const SUBTITLE_SEPARATOR_PATTERN = /[:：]/;
  const BRACKETED_VOLUME_PATTERN = /\s*[（(]\s*(?:\d+|[ivxlcdm]+|[零〇一二三四五六七八九十百千兩]+|上|中|下)\s*[）)]\s*$/iu;
  const MARKED_VOLUME_PATTERN = /\s*(?:第\s*)?(?:\d+|[ivxlcdm]+|[零〇一二三四五六七八九十百千兩]+)\s*(?:集|冊|卷|輯|部|篇|季|本)\s*$/iu;
  const BARE_NUMBER_PATTERN = /\s*[-_#]?\s*(?:\d+|[IVXLCDM]+)\s*$/u;
  const BARE_CHINESE_NUMBER_PATTERN = /\s*[零〇一二三四五六七八九十百千兩]+\s*$/u;
  const SPECIAL_VOLUME_PATTERN = /\s*(?:番外|特別|外傳)(?:篇|版)?\s*$/u;
  const MIN_SERIES_KEY_LENGTH = 3;
  const GRADE_ORDER = [
    "國小低年級",
    "國小中年級",
    "國小高年級",
    "國中",
    "高中",
    "其他"
  ];

  function normalizeGrade(value) {
    return String(value || "").normalize("NFKC").trim();
  }

  function bookGrade(book) {
    return normalizeGrade(book && (book.age_group || book.range));
  }

  function gradeOptions(books) {
    const counts = new Map();
    (books || []).forEach((book) => {
      const grade = bookGrade(book);
      if (grade) counts.set(grade, (counts.get(grade) || 0) + 1);
    });

    return [...counts.entries()]
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((left, right) => {
        const leftIndex = GRADE_ORDER.indexOf(left.value);
        const rightIndex = GRADE_ORDER.indexOf(right.value);
        const leftRank = leftIndex < 0 ? GRADE_ORDER.length : leftIndex;
        const rightRank = rightIndex < 0 ? GRADE_ORDER.length : rightIndex;
        return leftRank - rightRank || left.label.localeCompare(right.label, "zh-Hant");
      });
  }

  function filterByGrade(books, selectedGrade) {
    const grade = normalizeGrade(selectedGrade);
    if (!grade) return [...(books || [])];
    return (books || []).filter((book) => bookGrade(book) === grade);
  }

  function cleanTitleText(title) {
    return String(title || "")
      .normalize("NFKC")
      .replace(/臺/g, "台")
      .replace(EDITION_NOTE_PATTERN, "")
      .trim();
  }

  function normalizeSimilarTitle(title) {
    return cleanTitleText(title)
      .toLocaleLowerCase("zh-TW")
      .replace(/[\s\p{P}\p{S}]/gu, "")
      .replace(EDITION_SUFFIX_PATTERN, "");
  }

  function stripVolumeSuffix(title, hasSubtitle) {
    let result = title
      .replace(BRACKETED_VOLUME_PATTERN, "")
      .replace(MARKED_VOLUME_PATTERN, "")
      .replace(BARE_NUMBER_PATTERN, "")
      .replace(SPECIAL_VOLUME_PATTERN, "")
      .trim();

    // 中文數字本身也可能是一般書名的一部分，僅在明確有副標題時視為集數。
    if (hasSubtitle) result = result.replace(BARE_CHINESE_NUMBER_PATTERN, "").trim();
    return result;
  }

  /**
   * 產生系列鍵：忽略冒號後副標題、尾端集數／冊次及常見版本差異。
   * 若移除集數後只剩過短文字，退回完整書名以降低無關書籍誤合併的風險。
   */
  function seriesKey(title) {
    const cleanedTitle = cleanTitleText(title);
    if (!cleanedTitle) return "";

    const separatorIndex = cleanedTitle.search(SUBTITLE_SEPARATOR_PATTERN);
    const hasSubtitle = separatorIndex >= 0;
    const mainTitle = hasSubtitle
      ? cleanedTitle.slice(0, separatorIndex).trim()
      : cleanedTitle;
    const seriesTitle = stripVolumeSuffix(mainTitle, hasSubtitle);
    const key = normalizeSimilarTitle(seriesTitle);

    return [...key].length >= MIN_SERIES_KEY_LENGTH
      ? key
      : normalizeSimilarTitle(cleanedTitle);
  }

  function seriesLabel(title) {
    const cleanedTitle = cleanTitleText(title);
    const separatorIndex = cleanedTitle.search(SUBTITLE_SEPARATOR_PATTERN);
    const hasSubtitle = separatorIndex >= 0;
    const mainTitle = hasSubtitle
      ? cleanedTitle.slice(0, separatorIndex).trim()
      : cleanedTitle;
    const label = stripVolumeSuffix(mainTitle, hasSubtitle);

    return [...normalizeSimilarTitle(label)].length >= MIN_SERIES_KEY_LENGTH
      ? label
      : cleanedTitle;
  }

  function preferredLabel(books) {
    const titleCounts = new Map();
    books.forEach((book) => {
      const title = seriesLabel(book.title);
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
      const key = seriesKey(book.title);
      if (!key) return;
      if (!booksByKey.has(key)) booksByKey.set(key, []);
      booksByKey.get(key).push(book);
    });

    return [...booksByKey.entries()]
      .filter(([, groupBooks]) => groupBooks.length > 1)
      .map(([key, groupBooks]) => ({
        key,
        label: preferredLabel(groupBooks),
        count: groupBooks.length,
        books: groupBooks
      }))
      .sort((left, right) => {
        return right.count - left.count
          || left.label.localeCompare(right.label, "zh-Hant");
      });
  }

  const api = {
    normalizeGrade,
    gradeOptions,
    filterByGrade,
    normalizeSimilarTitle,
    seriesKey,
    buildSimilarTitleGroups
  };
  global.ReadingFinderTitleGroups = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
