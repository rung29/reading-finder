const test = require('node:test');
const assert = require('node:assert/strict');

const {
  gradeOptions,
  filterByGrade,
  normalizeSimilarTitle,
  seriesKey,
  buildSimilarTitleGroups
} = require('../title_groups.js');

test('normalizes harmless title variations', () => {
  assert.equal(normalizeSimilarTitle('臺灣古早厝'), normalizeSimilarTitle('台灣古早厝'));
  assert.equal(normalizeSimilarTitle('蛀牙蟲家族大搬家（新版）'), normalizeSimilarTitle('蛀牙蟲家族大搬家'));
  assert.equal(normalizeSimilarTitle('爸爸怪獸‧怪獸爸爸'), normalizeSimilarTitle('爸爸怪獸・怪獸爸爸'));
});

test('builds only groups containing at least two books', () => {
  const books = [
    { title: '小王子', id: 1 },
    { title: '小王子', id: 2 },
    { title: '臺灣古早厝', id: 3 },
    { title: '台灣古早厝', id: 4 },
    { title: '只有一本', id: 5 }
  ];

  const countsByLabel = new Map(
    buildSimilarTitleGroups(books).map(({ label, count }) => [label, count])
  );

  assert.equal(countsByLabel.size, 2);
  assert.equal(countsByLabel.get('台灣古早厝'), 2);
  assert.equal(countsByLabel.get('小王子'), 2);
});

test('does not merge books that only share a series-like prefix', () => {
  const groups = buildSimilarTitleGroups([
    { title: '我們的唐詩' },
    { title: '我們的宋詞' }
  ]);

  assert.deepEqual(groups, []);
});

test('merges numbered series with colon subtitles', () => {
  const titles = [
    '少年廚俠1：兩王的心結',
    '少年廚俠2：西湖鳴冤記',
    '少年廚俠3：消失的魔石',
    '少年廚俠4：除魔大神仙',
    '少年廚俠5：陰謀與真相'
  ];

  const books = titles.map(title => ({ title }));
  const [group] = buildSimilarTitleGroups(books);

  assert.equal(new Set(titles.map(seriesKey)).size, 1);
  assert.equal(group.key, '少年廚俠');
  assert.equal(group.label, '少年廚俠');
  assert.equal(group.count, 5);
  assert.deepEqual(group.books, books);
});

test('merges a series whose books differ only by colon subtitles', () => {
  assert.equal(
    seriesKey('魔法校車：電路大冒險'),
    seriesKey('魔法校車：人體神秘遊')
  );
});

test('merges series whose volume number is at the end', () => {
  assert.equal(seriesKey('少年廚俠1'), seriesKey('少年廚俠5'));
  assert.equal(seriesKey('漫畫科學王第1冊'), seriesKey('漫畫科學王第2冊'));
});

test('builds and filters grade options', () => {
  const books = [
    { title: '低年級書', age_group: '國小低年級' },
    { title: '低年級書 2', age_group: '國小低年級' },
    { title: '中年級書', age_group: '國小中年級' }
  ];

  assert.deepEqual(
    gradeOptions(books).map(({ value, count }) => ({ value, count })),
    [
      { value: '國小低年級', count: 2 },
      { value: '國小中年級', count: 1 }
    ]
  );
  assert.deepEqual(filterByGrade(books, '國小低年級'), books.slice(0, 2));
});
