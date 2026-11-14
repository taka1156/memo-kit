// 1 枚のページ（memo.py preview の出力）を、スマホ幅・PC 幅 × ライト・ダークで開いて、表示と色を確かめる。
//   node tests/visual/check.mjs <preview の HTML> <出力フォルダ> [--widths 375,1280]
// 使い方と結果の読み方は .claude/skills/memo-check/SKILL.md。
//
// 自動で見るもの（[要対応] があれば終了コード 1、[注意] だけなら 0）:
//   - 横スクロール・画面からはみ出す要素（スクロールできる箱の中は除く）           [要対応]
//   - コンソールのエラー・JS の例外（外部への通信は止めているので、その失敗は除く）   [要対応]
//   - 文字同士の重なり                                                               [注意]
//   - 文字と背景のコントラスト比（WCAG 2.x: 本文 4.5、大きい文字 3）                 3 未満 [要対応]・基準未満 [注意]
//   - 解説用の色（--c-*）: 背景との非テキストのコントラスト 3、色同士・色覚の違いを
//     まねた見え方での見分けやすさ、アクセント色との近さ                              [注意]
//   - スマホ幅での小さすぎる文字（10px 未満）・押しにくいボタン（24px 未満）         [注意]
// タブは 1 つずつ押し、<details> は開いてから同じことを確かめる。それ以外の操作（ステップ送りなど）は
// 見ないので、スキルの手順どおり自分で操作して撮る。
// 撮ったスクリーンショットは <出力フォルダ>/<sp|pc>-<light|dark>-NN.png（縦 1600px ごとに切る）。
// ブラウザは Playwright の Chromium。別のものを使うときは環境変数 MEMO_CHROME に実行ファイルのパス。
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const wi = args.indexOf('--widths');
const widths = wi >= 0 ? args.splice(wi, 2)[1].split(',').map(Number) : [375, 1280];
const [file, out] = args.map((p) => resolve(p));
if (!file || !out || widths.some((w) => !(w > 0))) {
  console.error('使い方: node tests/visual/check.mjs <preview の HTML> <出力フォルダ> [--widths 375,1280]');
  process.exit(2);
}
mkdirSync(out, { recursive: true });
const SLICE = 1600;

// ページの中で動かす検査。結果は { must: [...], note: [...] } の文字列。
function inspect(opts) {
  const must = [], note = [];
  const vw = document.documentElement.clientWidth;
  const cv = new OffscreenCanvas(1, 1);
  const g = cv.getContext('2d', { willReadFrequently: true });
  // どんな書き方の色（rgb・color(srgb)・oklab など）も、canvas に塗って RGBA に直す
  const rgba = (c) => {
    g.clearRect(0, 0, 1, 1); g.fillStyle = 'rgba(0,0,0,0)'; g.fillStyle = c; g.fillRect(0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255];
  };
  const over = (top, bottom) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1); };
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const name = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return `${el.tagName.toLowerCase()}${id}${cls}${txt ? `「${txt}」` : ''}`;
  };
  // 閉じた <details> の中身（content-visibility: hidden）や display: none の中は見えていないものとして扱う
  const shown = (el) => el.getClientRects().length > 0 && el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true });
  const opacity = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o; };
  // 背景を親へたどって重ねる。文字の位置を覆っていない親（はみ出して置いたラベルの親の細い線など）は飛ばす。
  // 画像やグラデーションの背景があれば判定しない（null）
  const background = (el, at) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const b = e.getBoundingClientRect();
      if (e !== document.documentElement && e !== document.body && (at.x < b.left || at.x > b.right || at.y < b.top || at.y > b.bottom)) continue;
      const s = getComputedStyle(e);
      if (s.backgroundImage !== 'none') return null;
      const c = rgba(s.backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
    }
    let base = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  };
  const clipped = (el) => {
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const o = getComputedStyle(e).overflowX;
      if (o !== 'visible') return true;
    }
    return false;
  };

  // 1. 横スクロール・はみ出し
  if (document.documentElement.scrollWidth > vw + 1) must.push(`横スクロールが出る（ページの幅 ${document.documentElement.scrollWidth}px > 画面 ${vw}px）`);
  const wide = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (!shown(el) || clipped(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > vw + 1 || r.left < -1) && !wide.some((p) => p.contains(el))) wide.push(el);
  }
  for (const el of wide.slice(0, 8)) must.push(`画面からはみ出す: ${name(el)}`);

  // 2. 文字を集める（見えている文字のかたまりごと）
  const texts = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() ? 1 : 3) });
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const el = n.parentElement;
    // クイズの表示（#memo-quiz-ui）は全ページ共通の部品なので見ない（共通部品の見た目は shoot.mjs・compare.mjs で見る）
    if (!el || el.closest('script, style, noscript, #memo-quiz-ui') || !shown(el)) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
    if (rects.length) texts.push({ el, rects });
  }

  // 3. 文字同士の重なり（親子関係にあるものどうしは除く）
  const hits = new Set();
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      for (const p of a.rects) for (const q of b.rects) {
        const w = Math.min(p.right, q.right) - Math.max(p.left, q.left);
        const h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
        if (w > 2 && h > 2 && w * h > 0.2 * Math.min(p.width * p.height, q.width * q.height)) hits.add(`${name(a.el)} と ${name(b.el)}`);
      }
    }
  }
  for (const h of [...hits].slice(0, 10)) note.push(`文字が重なっている: ${h}`);

  // 4. 文字のコントラスト
  const seen = new Map(); const dim = [], unknown = [];
  for (const { el, rects } of texts) {
    if (seen.has(el)) continue;
    const s = getComputedStyle(el);
    if (opacity(el) < 1) { dim.push(name(el)); seen.set(el, 1); continue; }   // わざと薄くしたもの（無効なボタン・省略された段など）
    const r0 = rects[0];
    const bg = background(el, { x: r0.left + r0.width / 2, y: r0.top + r0.height / 2 });
    if (!bg) { unknown.push(name(el)); seen.set(el, 1); continue; }
    const fg = over(rgba(s.color), bg);
    const r = ratio(fg, bg);
    const size = parseFloat(s.fontSize), bold = +s.fontWeight >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const msg = `${name(el)} 文字 ${hex(fg)} / 背景 ${hex(bg)} = ${r.toFixed(2)}`;
    if (r < 3) must.push(`コントラスト不足（3 未満）: ${msg}`);
    else if (r < need) note.push(`コントラストが基準（${need}）未満: ${msg}`);
    if (opts.sp && size < 10) note.push(`スマホ幅で文字が小さい（${size.toFixed(1)}px）: ${name(el)}`);
    seen.set(el, 1);
  }
  if (dim.length) note.push(`opacity で薄くした文字はコントラストを測っていない（無効・省略の表示なら問題ない。読ませたい文字なら薄くしない）: ${dim.slice(0, 3).join('、')}${dim.length > 3 ? ` ほか ${dim.length - 3} か所` : ''}`);
  if (unknown.length) note.push(`背景が画像・グラデーションの文字はコントラストを測れない（スクリーンショットで確かめる）: ${unknown.slice(0, 3).join('、')}${unknown.length > 3 ? ` ほか ${unknown.length - 3} か所` : ''}`);

  // 5. 押しにくいボタン（スマホ幅）
  if (opts.sp) {
    const small = [];
    for (const el of document.querySelectorAll('button, [role="tab"], [role="button"], summary, input, select, a.btn')) {
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) small.push(`${name(el)}（${Math.round(r.width)}×${Math.round(r.height)}）`);
    }
    for (const s of small.slice(0, 6)) note.push(`スマホ幅で押しにくい（24px 未満）: ${s}`);
  }
  return { must, note };
}

// 解説用の色（--c-*）の検査。ページで使っている色だけを見る。
function colors() {
  const note = [];
  const root = getComputedStyle(document.documentElement);
  const src = document.documentElement.outerHTML;
  const cv = new OffscreenCanvas(1, 1);
  const g = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { g.clearRect(0, 0, 1, 1); g.fillStyle = 'rgba(0,0,0,0)'; g.fillStyle = c; g.fillRect(0, 0, 1, 1); return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3); };
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // sRGB → Lab（D65）。色の差は CIE76 の ΔE で見る
  const lab = (c) => {
    const [r, gg, b] = c.map(lin);
    const x = (0.4124 * r + 0.3576 * gg + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * gg + 0.0722 * b, z = (0.0193 * r + 0.1192 * gg + 0.9505 * b) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  };
  const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
  // 色覚の違いをまねる（Machado ら 2009、強さ 1.0）。線形 RGB にかける
  const M = {
    '1 型（P 型）': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    '2 型（D 型）': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  };
  const unlin = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  const sim = (c, m) => { const l = c.map(lin); return m.map((row) => Math.min(255, Math.max(0, unlin(row[0] * l[0] + row[1] * l[1] + row[2] * l[2])))); };

  const used = [...new Set([...src.matchAll(/var\(\s*(--c-[\w-]+)/g)].map((m) => m[1]))]
    .filter((v) => root.getPropertyValue(v).trim());
  const col = Object.fromEntries(used.map((v) => [v, rgba(root.getPropertyValue(v).trim())]));
  const surface = rgba(root.getPropertyValue('--surface').trim() || '#fff');
  const bg = rgba(root.getPropertyValue('--bg').trim() || '#fff');
  const accent = rgba(root.getPropertyValue('--accent').trim() || '#000');
  for (const v of used) {
    const r = Math.min(ratio(col[v], surface), ratio(col[v], bg));
    if (r < 3) note.push(`${v} は背景とのコントラストが ${r.toFixed(2)}（線・枠・印として見分けるなら 3 以上。文字に使うなら 4.5 以上）`);
    if (Math.hypot(...col[v].map((x, i) => x - accent[i])) < 48) note.push(`${v} がアクセント色に近い（操作できる所に見える）`);
  }
  // 共通の意味の色どうし（--c-ok と --c-ng など）は、共通部品が記号（✗・✓ など）も付けるので組み合わせを見ない
  const shared = new Set(['--c-ok', '--c-ng', '--c-warn', '--c-hl']);
  for (let i = 0; i < used.length; i++) for (let j = i + 1; j < used.length; j++) {
    if (shared.has(used[i]) && shared.has(used[j])) continue;
    const a = col[used[i]], b = col[used[j]];
    const d = dE(a, b);
    if (d < 15) { note.push(`${used[i]} と ${used[j]} が似ている（ΔE ${d.toFixed(1)}）。同じ図で並べるなら見分けにくい`); continue; }
    for (const [k, m] of Object.entries(M)) {
      const ds = dE(sim(a, m), sim(b, m));
      if (ds < 10) note.push(`${used[i]} と ${used[j]} は ${k}の色覚では見分けにくい（ΔE ${ds.toFixed(1)}）。ラベル・形・線の種類でも区別する`);
    }
  }
  return { used, note };
}

const browser = await chromium.launch(process.env.MEMO_CHROME ? { executablePath: process.env.MEMO_CHROME } : {});
let fail = false;
try {
  for (const w of widths) {
    const sp = w < 600;
    const label = sp ? 'sp' : 'pc';
    for (const scheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 }, colorScheme: scheme, deviceScaleFactor: 1 });
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|ERR_BLOCKED|ERR_INTERNET|net::/.test(m.text())) errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.route(/^https?:/, (r) => r.abort());
      await page.goto('file://' + file);
      await page.addStyleTag({ content: '*{transition:none!important;animation:none!important}' });
      await page.waitForTimeout(100);

      // 最初の状態のスクリーンショット（縦に切る）
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0, n = 1; y < height; y += SLICE, n++) {
        await page.screenshot({ path: join(out, `${label}-${scheme}-${String(n).padStart(2, '0')}.png`), fullPage: true,
          clip: { x: 0, y, width: w, height: Math.min(SLICE, height - y) } });
      }

      // 同じ指摘は最初に見つけた状態で 1 回だけ出す（タブを押すたびに繰り返さない）
      const must = new Set(), note = new Set(), base = new Set();
      const put = (set, where, m) => { if (!base.has(m)) { base.add(m); set.add(where + m); } };
      const add = (r, where) => { r.must.forEach((m) => put(must, where, m)); r.note.forEach((m) => put(note, where, m)); };
      add(await page.evaluate(inspect, { sp }), '');
      // <details> を開いた状態
      if (await page.evaluate(() => { const d = [...document.querySelectorAll('details:not([open])')]; d.forEach((x) => { x.open = true; }); return d.length; })) {
        add(await page.evaluate(inspect, { sp }), '（details を開いて）');
      }
      // タブを 1 つずつ押した状態
      const tabs = await page.locator('[role="tab"], .tab').all();
      for (const t of tabs) {
        if (!(await t.isVisible())) continue;
        const txt = (await t.innerText()).trim().slice(0, 16);
        await t.click();
        add(await page.evaluate(inspect, { sp }), `（タブ「${txt}」）`);
      }
      const c = await page.evaluate(colors);
      c.note.forEach((m) => note.add(m));
      errors.forEach((e) => must.add(`コンソールのエラー: ${e}`));

      console.log(`\n== ${label.toUpperCase()} ${w}px / ${scheme}${c.used.length ? `（解説用の色: ${c.used.join(' ')}）` : ''}`);
      if (!must.size && !note.size) console.log('  問題なし');
      for (const m of must) console.log(`  [要対応] ${m}`);
      for (const m of note) console.log(`  [注意] ${m}`);
      if (must.size) fail = true;
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log(`\nスクリーンショット: ${out}`);
process.exit(fail ? 1 : 0);
