// shoot.mjs で撮った 2 回分（変更の前と後）を比べ、違うピクセルを赤くした画像を作る。
//   node tests/visual/compare.mjs <前のフォルダ> <後のフォルダ> <出力フォルダ>
// 違いがあれば一覧を出して終了コード 1（見た目が変わったことを知らせるだけ。意図した変更なら問題ない）。
// 比較は画像処理のライブラリを足さず、Playwright のブラウザの canvas で行う。
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const [before, after, out] = process.argv.slice(2).map((p) => resolve(p));
if (!before || !after || !out) {
  console.error('使い方: node tests/visual/compare.mjs <前のフォルダ> <後のフォルダ> <出力フォルダ>');
  process.exit(2);
}
mkdirSync(out, { recursive: true });
const names = readdirSync(after).filter((n) => n.endsWith('.png')).sort();
const browser = await chromium.launch(process.env.MEMO_CHROME ? { executablePath: process.env.MEMO_CHROME } : {});
const page = await browser.newPage();
const rows = [];
try {
  for (const name of names) {
    const b = join(before, name);
    if (!existsSync(b)) { rows.push([name, '前の画像がない']); continue; }
    const res = await page.evaluate(async ([x, y]) => {
      const load = (src) => new Promise((ok, ng) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ng; i.src = src; });
      const [a, c] = await Promise.all([load(x), load(y)]);
      const w = Math.max(a.width, c.width), h = Math.max(a.height, c.height);
      const px = (img) => { const cv = new OffscreenCanvas(w, h); const g = cv.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h); };
      const p = px(a), q = px(c);
      const cv = new OffscreenCanvas(w, h); const g = cv.getContext('2d');
      g.drawImage(c, 0, 0); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(0, 0, w, h);
      const d = g.getImageData(0, 0, w, h);
      let diff = 0;
      for (let i = 0; i < p.data.length; i += 4) {
        const delta = Math.abs(p.data[i] - q.data[i]) + Math.abs(p.data[i + 1] - q.data[i + 1]) + Math.abs(p.data[i + 2] - q.data[i + 2]);
        if (delta > 24) { diff++; d.data[i] = 230; d.data[i + 1] = 0; d.data[i + 2] = 0; d.data[i + 3] = 255; }
      }
      g.putImageData(d, 0, 0);
      const blob = await cv.convertToBlob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = ''; bytes.forEach((v) => { bin += String.fromCharCode(v); });
      return { diff, total: w * h, size: a.width === c.width && a.height === c.height, png: btoa(bin) };
    }, ['data:image/png;base64,' + readFileSync(b).toString('base64'),
        'data:image/png;base64,' + readFileSync(join(after, name)).toString('base64')]);
    if (res.diff || !res.size) {
      writeFileSync(join(out, name.replace('.png', '-diff.png')), Buffer.from(res.png, 'base64'));
      rows.push([name, `${res.diff} px（${(100 * res.diff / res.total).toFixed(2)}%）` + (res.size ? '' : '・大きさも違う')]);
    }
  }
} finally {
  await browser.close();
}
if (rows.length) {
  console.log('見た目が変わった画像（差分は *-diff.png の赤い部分）:');
  for (const [n, m] of rows) console.log(`- ${n}: ${m}`);
  process.exit(1);
}
console.log('見た目の違いなし');
