// src/assets/memo-site.js（仕組みのページで共通に使う処理）のテスト
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi, afterEach } from 'vitest';

const require = createRequire(import.meta.url);
const site = require('../../src/assets/memo-site.js');
// テストはリポジトリのルートで動かす（npm test）
const accents = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/accents.json'), 'utf8')).cases;

// 決まった順に値を返す乱数（シャッフルの結果を固定する）
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

describe('esc', () => {
  it('HTML の特殊文字をエスケープする', () => {
    expect(site.esc(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    expect(site.esc(3)).toBe('3');
  });
});

describe('shuffle', () => {
  it('元の配列を変えず、同じ要素の並べ替えを返す', () => {
    const a = [1, 2, 3, 4, 5];
    const b = site.shuffle(a, seq(0.1, 0.9, 0.5, 0.3));
    expect(a).toEqual([1, 2, 3, 4, 5]);
    expect([...b].sort()).toEqual(a);
  });
  it('偏りがない（各位置に各要素がほぼ同じ回数来る）', () => {
    const counts = Array.from({ length: 3 }, () => [0, 0, 0]);
    for (let n = 0; n < 6000; n++) site.shuffle([0, 1, 2]).forEach((v, i) => counts[i][v]++);
    for (const row of counts) for (const c of row) expect(c).toBeGreaterThan(1700);
  });
});

describe('クイズの条件', () => {
  const quizzes = [{ file: 'a.html' }, { file: 'b.html' }, { file: 'c.html' }];
  const tagsOf = { 'a.html': ['JS'], 'b.html': ['JS', 'Linux'], 'c.html': [] };
  it('quizPool: カテゴリのどれかに入る問題。カテゴリなしなら全問', () => {
    expect(site.quizPool(quizzes, tagsOf, []).length).toBe(3);
    expect(site.quizPool(quizzes, tagsOf, ['Linux']).map(q => q.file)).toEqual(['b.html']);
    expect(site.quizPool(quizzes, tagsOf, ['JS', 'Linux']).length).toBe(2);
  });
  it('tagCounts: タグごとの問題数', () => {
    expect(site.tagCounts(quizzes, tagsOf)).toEqual({ JS: 2, Linux: 1 });
  });
  it('ラベル', () => {
    expect(site.secLabel(30)).toBe('30 秒');
    expect(site.secLabel(180)).toBe('3 分');
    expect(site.tagsLabel([])).toBe('ランダム');
    expect(site.tagsLabel(['A', 'B', 'C', 'D'])).toBe('A・B ほか 2');
    expect(site.condLabel({ tags: ['A'], ta: 60 })).toBe('⏱ 1 分・A');
  });
  it('bestKey はタグの順番によらない', () => {
    expect(site.bestKey({ ta: 60, tags: ['b', 'a'] })).toBe(site.bestKey({ ta: 60, tags: ['a', 'b'] }));
    expect(site.bestKey({ ta: 30, tags: [] })).toBe('memo-quiz-ta:30:*');
  });
  it('countCorrect: 答えていない問題は数えない', () => {
    const qs = [{ answer: 0 }, { answer: 1 }, { answer: 2 }];
    expect(site.countCorrect(qs, [0, 0])).toBe(1);
  });
});

describe('選択肢のボタン', () => {
  const q = { choices: ['正', '誤1', '誤2'], answer: 0 };
  it('renderChoices: 全部の選択肢を 1 つずつ並べ、押すと番号を返す', () => {
    const box = document.createElement('div');
    const picked = [];
    site.renderChoices(box, q, k => picked.push(k), 'choice');
    expect([...box.children].map(b => b.textContent).sort()).toEqual([...q.choices].sort());
    expect([...box.children].every(b => b.className === 'choice')).toBe(true);
    [...box.children].find(b => b.textContent === '誤1').click();
    expect(picked).toEqual([1]);
  });
  it('markChoices: 正解に ok、選んだ誤答に ng、全部押せなくする', () => {
    const box = document.createElement('div');
    site.renderChoices(box, q, () => {}, 'c');
    expect(site.markChoices(box, q, 2)).toBe(false);
    const by = t => [...box.children].find(b => b.textContent === t);
    expect(by('正').classList.contains('ok')).toBe(true);
    expect(by('誤2').classList.contains('ng')).toBe(true);
    expect(by('誤1').className).toBe('c');
    expect([...box.children].every(b => b.disabled)).toBe(true);
  });
});

describe('色', () => {
  it('lightAccent は config.py の light_accent と同じ答え（tests/fixtures/accents.json）', () => {
    for (const [color, light] of Object.entries(accents)) expect(site.lightAccent(color), color).toBe(light);
  });
  it('contrast: 白と黒は 21', () => {
    expect(site.contrast('#fff', '#000')).toBeCloseTo(21, 5);
    expect(site.hex6('#ABC')).toBe('#aabbcc');
  });
});

describe('loadJSON', () => {
  afterEach(() => { delete globalThis.MEMO_DATA; vi.unstubAllGlobals(); });
  it('preview で埋め込まれたデータがあればそれを使う', async () => {
    globalThis.MEMO_DATA = { 'memos.json': [{ file: 'a.html' }] };
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await site.loadJSON('memos.json')).toEqual([{ file: 'a.html' }]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('fresh なら CDN のキャッシュを避ける', async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => [] }));
    vi.stubGlobal('fetch', fetch);
    await site.loadJSON('quizzes.json', true);
    expect(fetch.mock.calls[0][0]).toMatch(/^quizzes\.json\?_=\d+$/);
    expect(fetch.mock.calls[0][1]).toEqual({ cache: 'no-store' });
  });
  it('読めなければ例外', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    await expect(site.loadJSON('memos.json')).rejects.toThrow('memos.json: HTTP 404');
  });
});
