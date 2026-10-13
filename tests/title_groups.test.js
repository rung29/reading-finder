const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeSimilarTitle,
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
