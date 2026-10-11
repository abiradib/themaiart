// usage: node render.mjs <pdf> <outDir> <targetWidthPx>
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import sharp from 'sharp';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const [pdfPath, outDir, widthArg] = process.argv.slice(2);
const target = Number(widthArg || 2400);
fs.mkdirSync(outDir, { recursive: true });

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const doc = await pdfjs.getDocument({
  data: new Uint8Array(fs.readFileSync(pdfPath)),
  standardFontDataUrl: path.join(root, 'node_modules/pdfjs-dist/standard_fonts/') ,
  cMapUrl: path.join(root, 'node_modules/pdfjs-dist/cmaps/'),
  cMapPacked: true,
}).promise;

const meta = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const vp1 = page.getViewport({ scale: 1 });
  const scale = target / vp1.width;
  const vp = page.getViewport({ scale });
  const canvas = createCanvas(Math.round(vp.width), Math.round(vp.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const png = canvas.toBuffer('image/png');
  const n = String(i).padStart(2, '0');
  fs.writeFileSync(path.join(outDir, `page-${n}.png`), png);
  const tc = await page.getTextContent();
  const lines = [];
  let cur = '';
  for (const it of tc.items) { cur += it.str; if (it.hasEOL) { lines.push(cur); cur = ''; } }
  if (cur) lines.push(cur);
  meta.push({ page: i, width: canvas.width, height: canvas.height, text: lines.map(s => s.trim()).filter(Boolean) });
  console.log(`page ${i}: ${canvas.width}x${canvas.height}`);
  page.cleanup();
}
fs.writeFileSync(path.join(outDir, 'pages.json'), JSON.stringify(meta, null, 2));
