// トップ・クイズ・設定・ロードマップのページ（仕組みのページ）で共通に使う処理。
// 各ページは <script src="assets/memo-site.js"></script> で読み込み、window.MemoSite から使う。
// memo.py preview はこのファイルをページに埋め込むので、1 枚でも動く。
// 色の計算は scripts/memolib/config.py の light_accent と同じ式（変えたら両方を直す。tests/fixtures/accents.json で突き合わせる）。
// テストは tests/js/（vitest）。
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MemoSite = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- 文字列
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s).replace(/[&<>"']/g, c => ESC[c]);

  // ---- データの読み込み
  // 一覧は memos.json、問題は quizzes.json（memo.py build が生成）。
  // memo.py preview で作ったプレビュー用のコピーでは、埋め込まれた window.MEMO_DATA を使う。
  // fresh: GitHub Pages の CDN キャッシュも避けて最新を取りに行く
  async function loadJSON(name, fresh) {
    const embedded = globalThis.MEMO_DATA;
    if (embedded && embedded[name]) return embedded[name];
    const res = await fetch(fresh ? `${name}?_=${Date.now()}` : name, { cache: fresh ? 'no-store' : 'no-cache' });
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    return res.json();
  }

  // ---- クイズ
  // 偏りのないシャッフル（Fisher–Yates）。元の配列は変えない。rand はテスト用に差し替えられる
  function shuffle(a, rand = Math.random) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 選んだカテゴリ（タグ）のどれかに入る問題。カテゴリなしなら全問
  const quizPool = (quizzes, tagsOf, tags) => tags.length
    ? quizzes.filter(q => (tagsOf[q.file] || []).some(t => tags.includes(t)))
    : quizzes;

  // タグごとの問題数
  function tagCounts(quizzes, tagsOf) {
    const counts = {};
    for (const q of quizzes) for (const t of tagsOf[q.file] || []) counts[t] = (counts[t] || 0) + 1;
    return counts;
  }

  const secLabel = sec => sec % 60 ? `${sec} 秒` : `${sec / 60} 分`;
  const tagsLabel = tags => !tags.length ? 'ランダム'
    : tags.length <= 2 ? tags.join('・') : `${tags.slice(0, 2).join('・')} ほか ${tags.length - 2}`;
  const condLabel = c => (c.ta ? `⏱ ${secLabel(c.ta)}・` : '') + tagsLabel(c.tags);
  // タイムアタックの自己ベストを保存するキー（条件ごと。タグの順番によらない）
  const bestKey = c => `memo-quiz-ta:${c.ta}:${c.tags.length ? c.tags.slice().sort().join(',') : '*'}`;
  // 正解の数
  const countCorrect = (questions, picks) => questions.filter((q, i) => picks[i] === q.answer).length;

  // 選択肢のボタンを並べる（順番は毎回シャッフル。正解の位置で覚えないように）
  function renderChoices(box, q, onPick, className, rand) {
    box.textContent = '';
    for (const k of shuffle(q.choices.map((_, i) => i), rand)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = className;
      b.textContent = q.choices[k];
      b.dataset.k = k;
      b.onclick = () => onPick(k);
      box.appendChild(b);
    }
  }

  // 答えたあと: ボタンを押せなくし、正解に ok、選んだ誤答に ng を付ける
  function markChoices(box, q, k) {
    for (const b of box.children) {
      b.disabled = true;
      if (+b.dataset.k === q.answer) b.classList.add('ok');
      else if (+b.dataset.k === k) b.classList.add('ng');
    }
    return k === q.answer;
  }

  // ---- 色（WCAG のコントラスト比）
  const hex6 = c => {
    c = c.trim().toLowerCase();
    return /^#[0-9a-f]{3}$/.test(c) ? '#' + [...c.slice(1)].map(x => x + x).join('') : c;
  };
  const rgb = c => [1, 3, 5].map(i => parseInt(hex6(c).slice(i, i + 2), 16));
  const luminance = c => {
    const [r, g, b] = rgb(c).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const darken = (c, ratio) => '#' + rgb(c).map(v => Math.round(v * ratio).toString(16).padStart(2, '0')).join('');
  // 白地でコントラスト比 4.5 以上になるまで暗くする（config.py の light_accent と同じ）
  const lightAccent = c => {
    let ratio = 1;
    while (contrast(darken(c, ratio), '#ffffff') < 4.5 && ratio > 0) ratio = Math.round((ratio - 0.02) * 100) / 100;
    return darken(c, Math.max(ratio, 0));
  };

  return {
    esc, loadJSON,
    shuffle, quizPool, tagCounts, secLabel, tagsLabel, condLabel, bestKey, countCorrect, renderChoices, markChoices,
    hex6, rgb, luminance, contrast, darken, lightAccent,
  };
});
