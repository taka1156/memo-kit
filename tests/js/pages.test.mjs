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

async function open(page, search = '') {
  const file = join(out, `${page}.html`);
  execFileSync('python3', ['scripts/memo.py', 'preview', page, '-o', file], { cwd: root });
  const win = new Window({
    url: `http://localhost/${page}.html${search}`,
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
      // 索引（pagefind/）の無い 1 枚版でも、全角で打ったタイトルで見つかる
      const wide = s => s.normalize('NFKC').replace(/[A-Za-z0-9]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xFEE0));
      q.value = wide(memos[0].title);
      q.dispatchEvent(new doc.defaultView.Event('input'));
      expect([...doc.querySelectorAll('#list .card')].map(a => a.getAttribute('href'))).toContain(memos[0].file);
    }
  });

  it('index: ?q= で開くと検索欄に入って絞り込まれ、打つと URL の ?q= が変わる', async () => {
    const { win, doc, data, errors } = await open('index', '?q=' + encodeURIComponent('これに当たるメモは無いはず-zzz'));
    expect(errors).toEqual([]);
    const q = doc.getElementById('q');
    expect(q.value).toBe('これに当たるメモは無いはず-zzz');
    if (data['memos.json'].length) expect(doc.querySelectorAll('#list .card').length).toBe(0);
    q.value = 'docker';
    q.dispatchEvent(new win.Event('input'));
    expect(new URL(win.location.href).searchParams.get('q')).toBe('docker');
    q.value = '';
    q.dispatchEvent(new win.Event('input'));
    expect(new URL(win.location.href).search).toBe('');
    expect(doc.querySelectorAll('#list .card').length).toBe(data['memos.json'].length);
  });

  it('index: ?tag= で開くとそのタグで絞り込まれ、タグを押すと URL の ?tag= が変わる', async () => {
    const memos = (await open('index')).data['memos.json'];
    const tag = memos.flatMap(m => m.tags || [])[0];
    if (!tag) return;
    const { win, doc, errors } = await open('index', '?tag=' + encodeURIComponent(tag));
    expect(errors).toEqual([]);
    const pressed = [...doc.querySelectorAll('#tags .tag')].filter(b => b.getAttribute('aria-pressed') === 'true');
    expect(pressed.map(b => b.textContent)).toEqual([tag]);
    expect(doc.querySelectorAll('#list .card').length).toBe(memos.filter(m => (m.tags || []).includes(tag)).length);
    pressed[0].click();
    expect(new URL(win.location.href).searchParams.get('tag')).toBeNull();
    expect(doc.querySelectorAll('#list .card').length).toBe(memos.length);
  });

  it('index: 一覧に無いタグの ?tag= は無視して全件を出す', async () => {
    const { doc, data, errors } = await open('index', '?tag=' + encodeURIComponent('無いタグ-zzz'));
    expect(errors).toEqual([]);
    expect(doc.querySelectorAll('#list .card').length).toBe(data['memos.json'].length);
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
