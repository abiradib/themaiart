// usage: node build.mjs <renderedPngDir> <pdfPath> <siteDir>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const [pngDir, pdfPath, site] = process.argv.slice(2);
const imgDir = path.join(site, 'assets', 'img');
const pagesDir = path.join(site, 'pages');
fs.mkdirSync(imgDir, { recursive: true });
fs.mkdirSync(pagesDir, { recursive: true });

const TITLES = [
  'Cover',
  'Absented — Introduction',
  'Amanda Thompson — About the Artist',
  'Amanda Thompson — Artist Statement',
  '7 Years — Amanda Thompson',
  'Devon McCulloch — About the Artist',
  'Departed — Artist Statement',
  'Departed — Devon McCulloch',
  'Reem Ali Acason — About the Artist',
  'Reem Ali Acason — Artist Statement',
  'Preparations for a Lunar Eclipse III',
  'Preparations for a Lunar Eclipse III (Detail)',
  'Preparations for a Lunar Eclipse II',
  'Preparations for a Lunar Eclipse II (Detail)',
  'Mai Aboassi — About the Artist',
  'Mai Aboassi — Artist Statement',
  'The Marginalised Fava Bean Pods',
  'May Qadoura — About Me',
  'May Qadoura — Artist Statement',
  'Victoria Koch — About the Artist',
  'Out of Register — Artist Statement',
  'Out of Register — Victoria Koch',
  'Out of Register (Detail)',
  'Project',
  'Project',
  'Textile Installation',
  'Portrait Series',
  'Food Photography — Project 02',
  'Project',
  'Street Photography — Project 03',
  'Project',
  'Project Series',
  'Project',
  'Street Series',
  'Hope to Work with You Soon',
  'List of Works',
  'List of Works (continued)',
  'List of Works (continued)',
  'Back Cover',
];

const WIDTHS = [480, 1200, 2400];
const pngs = fs.readdirSync(pngDir).filter(f => /^page-\d+\.png$/.test(f)).sort();
const N = pngs.length;
if (N !== TITLES.length) throw new Error(`expected ${TITLES.length} pages, found ${N}`);

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pad = i => String(i).padStart(2, '0');

// Cover pages are letter-spaced display type; their text is written out by hand.
const COVER_TEXT = [
  'Catalogue',
  'ABSENTED <span lang="ar" dir="rtl">مغيَّبة</span><br>Group Exhibition',
  '11–24 November 2026<br>Wasl Gallery | <span lang="ar" dir="rtl">غاليري وصل</span><br>Jordan National Gallery of Fine Arts | Amman, Jordan<br>Curated by May Qadoura',
  'Artists:<br>Amanda Thompson · Devon McCulloch · Reem Ali Acason · Mai Aboassi · May Qadoura · Victoria Koch',
];
const TEXT_OVERRIDES = { 1: COVER_TEXT, [N]: COVER_TEXT };

// Arabic presentation forms (visual-order glyphs from the PDF) and bidi controls
const PRES_FORMS = /[ﭐ-﷿ﹰ-﻿؀-ۿ‎‏‪-‮]/g;
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function pageText(i) {
  if (TEXT_OVERRIDES[i]) return TEXT_OVERRIDES[i];
  const raw = execFileSync('pdftotext', ['-raw', '-enc', 'UTF-8', '-f', String(i), '-l', String(i), pdfPath, '-'], { encoding: 'utf8' });
  let lines = raw.replace(/\f/g, '').replace(/�/g, '·').split(/\r?\n/)
    .map(l => l.replace(PRES_FORMS, '').replace(/\s+/g, ' ').trim())
    .filter(l => l && l !== 'ABSENTED');
  // Drop running heads that repeat an earlier line (e.g. "Amanda thompson" after "Amanda" / "Thompson").
  const seen = new Set();
  lines = lines.filter((l, k) => {
    const n = norm(l);
    if (/[a-z]/.test(n) && seen.has(n) && k >= lines.length - 3) return false;
    seen.add(n);
    if (k > 0) seen.add(norm(lines[k - 1]) + n);
    return true;
  });
  // Rebuild paragraphs: long lines that don't end a sentence are soft wraps;
  // runs of short lines (titles, captions) keep their line breaks.
  const LONG = 40;
  const paras = [];
  let cur = '';
  lines.forEach((l, k) => {
    if (k === 0) { cur = esc(l); return; }
    const prev = lines[k - 1];
    const prevLong = prev.length >= LONG;
    const ends = /[.!?:]["”’)]?$/.test(prev);
    const long = l.length >= LONG;
    const soft = prevLong && !ends && (long || /^[a-z(,]/.test(l));
    if (soft) cur += ' ' + esc(l);
    else if (long && (ends || !prevLong)) { paras.push(cur); cur = esc(l); }
    else cur += '<br>' + esc(l);
  });
  if (cur) paras.push(cur);
  return paras;
}

const head = (title, desc, rel) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#f4f2ee">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500&family=Inter:wght@400;500&display=swap">
<link rel="stylesheet" href="${rel}assets/style.css">
<link rel="icon" href="${rel}assets/img/page-01-480.webp">`;

const picture = (i, sizes, cls, alt, loading) => {
  const n = pad(i);
  const srcset = WIDTHS.map(w => `../assets/img/page-${n}-${w}.webp ${w}w`).join(', ');
  return `<picture>
      <source type="image/webp" srcset="${srcset}" sizes="${sizes}">
      <img class="${cls}" src="../assets/img/page-${n}-1200.jpg" width="2400" height="1800" alt="${esc(alt)}" loading="${loading}" decoding="async">
    </picture>`;
};

// ---- images
for (let i = 1; i <= N && !process.env.SKIP_IMG; i++) {
  const src = path.join(pngDir, pngs[i - 1]);
  const n = pad(i);
  for (const w of WIDTHS) {
    await sharp(src).resize(w).webp({ quality: w <= 480 ? 72 : 82 }).toFile(path.join(imgDir, `page-${n}-${w}.webp`));
  }
  await sharp(src).resize(1200).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(imgDir, `page-${n}-1200.jpg`));
  process.stdout.write(`img ${n} `);
}
console.log();

// ---- slide pages
const SITE = 'Absented — Group Exhibition Catalogue';
for (let i = 1; i <= N; i++) {
  const n = pad(i);
  const title = TITLES[i - 1];
  const paras = pageText(i);
  const prev = i > 1 ? `page-${pad(i - 1)}.html` : null;
  const next = i < N ? `page-${pad(i + 1)}.html` : null;
  const navLink = (href, label, dir) => href
    ? `<a class="nav-btn" href="${href}" rel="${dir}" aria-label="${label} page"><span aria-hidden="true">${dir === 'prev' ? '←' : '→'}</span><span class="nav-label">${label}</span></a>`
    : `<span class="nav-btn is-disabled" aria-hidden="true"><span>${dir === 'prev' ? '←' : '→'}</span><span class="nav-label">${label}</span></span>`;
  const textBlock = paras.length ? `
  <section class="page-text" aria-labelledby="text-title">
    <details id="text-details">
      <summary id="text-title">Read page text</summary>
      <div class="page-text-body">
        ${paras.map(p => `<p>${p}</p>`).join('\n        ')}
      </div>
    </details>
  </section>` : '';

  const html = `${head(`${title} · ${i}/${N} · Absented`, `${title} — page ${i} of the Absented group exhibition catalogue.`, '../')}
${next ? `<link rel="prefetch" href="${next}">\n<link rel="prefetch" href="../assets/img/page-${pad(i + 1)}-1200.webp" as="image">` : ''}
</head>
<body class="slide-page" data-prev="${prev ?? ''}" data-next="${next ?? ''}">
  <a class="skip" href="#slide">Skip to page</a>
  <header class="topbar">
    <a class="brand" href="../index.html" aria-label="Absented catalogue home">Absented <span lang="ar" dir="rtl">مغيَّبة</span></a>
    <h1 class="slide-title">${esc(title)}</h1>
    <a class="grid-link" href="../index.html#page-${n}" aria-label="All pages">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/></svg>
      <span class="grid-label">All pages</span>
    </a>
  </header>

  <main id="slide" class="stage">
    <button class="slide-btn" type="button" aria-label="Zoom in on page ${i}">
    ${picture(i, '(max-width: 600px) 100vw, (max-width: 1400px) 92vw, 1400px', 'slide', `Page ${i}: ${title}`, 'eager')}
    </button>
  </main>

  <nav class="pager" aria-label="Page navigation">
    ${navLink(prev, 'Previous', 'prev')}
    <span class="counter" aria-live="polite"><strong>${i}</strong> / ${N}</span>
    ${navLink(next, 'Next', 'next')}
  </nav>
${textBlock}

  <div class="zoom" id="zoom" hidden role="dialog" aria-modal="true" aria-label="Zoomed page ${i}">
    <button class="zoom-close" type="button" aria-label="Close zoom">✕</button>
    <div class="zoom-scroll"><img src="../assets/img/page-${n}-2400.webp" width="2400" height="1800" alt="Page ${i}: ${esc(title)}, full size" loading="lazy"></div>
  </div>
  <script src="../assets/viewer.js" defer></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(pagesDir, `page-${n}.html`), html);
}

// ---- index
const cards = TITLES.map((t, k) => {
  const i = k + 1, n = pad(i);
  return `      <li id="page-${n}">
        <a class="card" href="pages/page-${n}.html">
          <picture>
            <source type="image/webp" srcset="assets/img/page-${n}-480.webp 480w, assets/img/page-${n}-1200.webp 1200w" sizes="(max-width: 520px) 92vw, (max-width: 900px) 46vw, 300px">
            <img src="assets/img/page-${n}-1200.jpg" width="2400" height="1800" alt="" loading="${i <= 8 ? 'eager' : 'lazy'}" decoding="async">
          </picture>
          <span class="card-meta"><span class="card-num">${n}</span><span class="card-title">${esc(t)}</span></span>
        </a>
      </li>`;
}).join('\n');

const index = `${head(SITE, 'Absented (مغيَّبة) — a group exhibition curated by May Qadoura. 11–24 November 2026, Wasl Gallery, Jordan National Gallery of Fine Arts, Amman.', '')}
</head>
<body class="home">
  <a class="skip" href="#pages">Skip to pages</a>
  <header class="hero">
    <div class="hero-text">
      <p class="eyebrow">Catalogue · Group Exhibition</p>
      <h1>Absented <span lang="ar" dir="rtl">مغيَّبة</span></h1>
      <p class="hero-info">11–24 November 2026<br>Wasl Gallery <span lang="ar" dir="rtl">غاليري وصل</span><br>Jordan National Gallery of Fine Arts · Amman, Jordan<br>Curated by May Qadoura</p>
      <p class="hero-artists">Amanda Thompson · Devon McCulloch · Reem Ali Acason · Mai Aboassi · May Qadoura · Victoria Koch</p>
      <div class="hero-actions">
        <a class="button" href="pages/page-01.html">Start reading</a>
        <a class="button button-ghost" href="Presentation_compressed.pdf" target="_blank" rel="noopener">Open PDF</a>
      </div>
    </div>
    <a class="hero-cover" href="pages/page-01.html" aria-label="Open the cover">
      <picture>
        <source type="image/webp" srcset="assets/img/page-01-1200.webp 1200w, assets/img/page-01-2400.webp 2400w" sizes="(max-width: 900px) 92vw, 55vw">
        <img src="assets/img/page-01-1200.jpg" width="2400" height="1800" alt="Catalogue cover: Absented, group exhibition">
      </picture>
    </a>
  </header>

  <main id="pages" class="pages">
    <h2>All pages <span class="muted">(${N})</span></h2>
    <ol class="grid">
${cards}
    </ol>
  </main>

  <footer class="footer">
    <p>© 2026 Absented · <span lang="ar" dir="rtl">مغيَّبة</span> — curated by May Qadoura</p>
    <a href="#pages">Back to top</a>
  </footer>
</body>
</html>
`;
fs.writeFileSync(path.join(site, 'index.html'), index);
console.log(`built ${N} pages`);
