// 仕組みのページ（index・quiz・settings・roadmap）を memo.py preview の 1 枚版で開き、
// 共通の処理（memo-site.js）を使って画面が組み立てられるかを確かめる（ページの JS を切り出したときの確認用）
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

const root = process.cwd();  // テストはリポジトリのルートで動かす（npm test）
const out = mkdtempSync(join(tmpdir(), 'memo-pages-'));

async function open(page) {
  const file = join(out, `${page}.html`);
  execFileSync('python3', ['scripts/memo.py', 'preview', page, '-o', file], { cwd: root });
  const win = new Window({
    url: `http://localhost/${page}.html`,
    settings: { enableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true },
  });
  const errors = [];
  win.addEventListener('error', e => errors.push(e.error || e.message));
  win.document.write(readFileSync(file, 'utf8'));
  await win.happyDOM.waitUntilComplete();
  await new Promise(r => win.setTimeout(r, 20));
  return { win, doc: win.document, data: win.MEMO_DATA || {}, errors };
}

describe('仕組みのページ', () => {
  it('index: 一覧が並び、検索で絞り込める', async () => {
    const { doc, data, errors } = await open('index');
    expect(errors).toEqual([]);
    const memos = data['memos.json'];
    expect(doc.querySelectorAll('#list .card').length).toBe(memos.length);
    if (memos.length) {
      const q = doc.getElementById('q');
      q.value = 'これに当たるメモは無いはず-zzz';
      q.dispatchEvent(new doc.defaultView.Event('input'));
      expect(doc.querySelectorAll('#list .card').length).toBe(0);
      expect(doc.getElementById('empty').hidden).toBe(false);
    }
  });

  it('quiz: ランダムで始めて答えると、正誤と次へのボタンが出る', async () => {
    const { doc, data, errors } = await open('quiz');
    expect(errors).toEqual([]);
    const quizzes = data['quizzes.json'] || [];
    if (!quizzes.length) {
      expect(doc.getElementById('no-quiz').hidden).toBe(false);
      return;
    }
    doc.getElementById('start-random').click();
    expect(doc.getElementById('play').hidden).toBe(false);
    const buttons = doc.querySelectorAll('#choices .choice');
    expect(buttons.length).toBeGreaterThan(1);
    buttons[0].click();
    expect(doc.getElementById('feedback').hidden).toBe(false);
    expect(doc.querySelectorAll('#choices .ok').length).toBe(1);
    expect(doc.getElementById('next').hidden).toBe(false);
  });

  it('settings: 候補が並び、選ぶと JSON の欄が変わる', async () => {
    const { doc, errors } = await open('settings');
    expect(errors).toEqual([]);
    const presets = doc.querySelectorAll('#presets .preset');
    expect(presets.length).toBeGreaterThan(0);
    presets[1].click();
    expect(doc.getElementById('out-dark').textContent).toBe(presets[1].dataset.dark);
    expect(doc.getElementById('out-json').textContent).toContain(presets[1].dataset.dark);
  });

  it('roadmap: 分野ごとのチェックリストが組み立てられる', async () => {
    const { doc, errors } = await open('roadmap');
    expect(errors).toEqual([]);
    expect(doc.querySelectorAll('#areas .area').length).toBeGreaterThan(0);
    expect(doc.getElementById('overall-num').textContent).toMatch(/\d+ \/ \d+/);
  });
});
