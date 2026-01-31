import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

const inPath = getArg('--in');
const outPath = getArg('--out');

if (!inPath || !outPath) {
  console.error('Usage: node scripts/audit-pdf/generate-audit-pdf.mjs --in <input.json> --out <output.pdf>');
  process.exit(1);
}

const input = JSON.parse(fs.readFileSync(inPath, 'utf8'));

const logoPath = path.resolve('src/assets/images/logo-dark.svg');
const logoSvg = fs.existsSync(logoPath) ? fs.readFileSync(logoPath, 'utf8') : null;

fs.mkdirSync(path.dirname(outPath), { recursive: true });

// --- Layout constants (A4)
const doc = new PDFDocument({ size: 'A4', margin: 48 });
const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

const pageWidth = doc.page.width;
const pageHeight = doc.page.height;
const m = doc.page.margins;

const colors = {
  text: '#0f172a',
  muted: '#475569',
  light: '#94a3b8',
  accent: '#2563eb',
  border: '#e2e8f0',
};

function h1(text) {
  doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(18).text(text);
}

function h2(text) {
  doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(12).text(text);
}

function p(text) {
  doc.fillColor(colors.muted).font('Helvetica').fontSize(10).text(text, { lineGap: 2 });
}

function small(text) {
  doc.fillColor(colors.light).font('Helvetica').fontSize(8).text(text);
}

function divider() {
  const y = doc.y + 10;
  doc.moveTo(m.left, y).lineTo(pageWidth - m.right, y).lineWidth(1).strokeColor(colors.border).stroke();
  doc.moveDown(1.2);
}

function box({ x, y, w, h }) {
  doc.save();
  doc.roundedRect(x, y, w, h, 10).lineWidth(1).strokeColor(colors.border).stroke();
  doc.restore();
}

// --- Header
if (logoSvg) {
  // Keep it small and tidy
  SVGtoPDF(doc, logoSvg, m.left, m.top - 6, { width: 92 });
}

doc
  .fillColor(colors.light)
  .font('Helvetica')
  .fontSize(9)
  .text('Website Audit (1-page PDF)', m.left, m.top, { align: 'right', width: pageWidth - m.left - m.right });

// Move below header area
let yStart = m.top + 34;
doc.y = yStart;

h1('Quick Wins Website Audit');

doc.moveDown(0.3);
p(`${input?.lead?.business ?? 'Business'} • ${input?.lead?.area ?? ''}`.trim());
small(`Website: ${input?.lead?.website ?? ''}`);
small(`Generated: ${input?.meta?.generatedAt ?? ''} • Reply: ${input?.meta?.contactEmail ?? 'info@uxhm.co.uk'}`);

// Score pill
const score = input?.score?.overall;
if (typeof score === 'number') {
  const pillW = 120;
  const pillH = 28;
  const x = pageWidth - m.right - pillW;
  const y = m.top + 34;
  doc.save();
  doc.roundedRect(x, y, pillW, pillH, 14).fillAndStroke('#eff6ff', colors.border);
  doc.fillColor(colors.accent).font('Helvetica-Bold').fontSize(12).text(`Score: ${score}/100`, x, y + 7, { width: pillW, align: 'center' });
  doc.restore();
}

doc.moveDown(0.8);
if (input?.score?.notes) {
  p(input.score.notes);
}

divider();

// --- Top Fixes (5)
h2('Top fixes (priority order)');
doc.moveDown(0.4);

const fixes = Array.isArray(input?.topFixes) ? input.topFixes.slice(0, 5) : [];
const startY = doc.y;
const colGap = 14;
const colW = (pageWidth - m.left - m.right - colGap) / 2;

function renderFixCard(idx, fix, x, y) {
  const h = 86;
  box({ x, y, w: colW, h });
  doc.save();
  doc.fillColor(colors.accent).font('Helvetica-Bold').fontSize(10).text(`${idx + 1}. ${fix.title ?? ''}`, x + 12, y + 10, { width: colW - 24 });
  doc.fillColor(colors.muted).font('Helvetica').fontSize(9).text(fix.why ?? '', x + 12, y + 30, { width: colW - 24, height: 36 });
  doc.fillColor(colors.light).font('Helvetica').fontSize(8).text(`Effort: ${fix.effort ?? '—'}`, x + 12, y + 68, { width: colW - 24 });
  doc.restore();
  return h;
}

let rowY = startY;
for (let i = 0; i < fixes.length; i += 2) {
  const left = fixes[i];
  const right = fixes[i + 1];
  renderFixCard(i, left, m.left, rowY);
  if (right) renderFixCard(i + 1, right, m.left + colW + colGap, rowY);
  rowY += 96;
}

doc.y = rowY;

divider();

// --- Offer
h2('If you want us to implement it');
doc.moveDown(0.3);

const offerLines = [
  ...(input?.offer?.paidOptions ?? []),
].filter(Boolean);

doc.fillColor(colors.muted).font('Helvetica').fontSize(10);
if (offerLines.length) {
  for (const line of offerLines.slice(0, 3)) {
    doc.text(`• ${line}`);
  }
}

doc.moveDown(0.5);
doc.fillColor(colors.accent).font('Helvetica-Bold').text(`Reply to: ${input?.meta?.contactEmail ?? 'info@uxhm.co.uk'}`);

// Footer
const footerY = pageHeight - m.bottom + 10;
doc.save();
doc.fillColor(colors.light).font('Helvetica').fontSize(8).text('UXHM • No obligation • If you prefer we don\'t contact you again, reply “opt out”.', m.left, footerY, {
  width: pageWidth - m.left - m.right,
  align: 'center',
});
doc.restore();

doc.end();

await new Promise((resolve, reject) => {
  stream.on('finish', resolve);
  stream.on('error', reject);
});

console.log(`Wrote: ${outPath}`);
