#!/usr/bin/env node
/**
 * Builds the printed promo material for a given URL:
 *   docs/promo/out/qr.svg     vector QR (for print)
 *   docs/promo/out/qr.png     1024px QR (for chat, social, Word...)
 *   docs/promo/out/flyer.html A4 flyer with the QR filled in
 *   docs/promo/out/flyer.pdf  print-ready PDF (needs Chrome/Chromium; set CHROME=/path/to/chrome if not found)
 *   docs/promo/out/flyer-gratis.html/.pdf  "SKENIRAJ ZA NAGRADE" flyer; its QR uses ?src=gratis, which shows the prize popup on /welcome
 *
 * Usage: npm run promo -- https://your-domain/welcome?src=qr
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import QRCode from 'qrcode';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const promo = join(root, 'docs', 'promo');
const out = join(promo, 'out');

const url = process.argv[2];
if (!url || !/^https?:\/\//.test(url)) {
  console.error('Usage: npm run promo -- https://your-domain/welcome?src=qr');
  process.exit(1);
}

const qrOptions = { errorCorrectionLevel: 'M', margin: 2, color: { dark: '#0f172aff', light: '#ffffffff' } };
mkdirSync(out, { recursive: true });

// 1. QR codes
const svg = await QRCode.toString(url, { ...qrOptions, type: 'svg' });
writeFileSync(join(out, 'qr.svg'), svg);
await QRCode.toFile(join(out, 'qr.png'), url, { ...qrOptions, width: 1024 });

// 2. Flyer HTML: the printed address drops the protocol and the ?src=… tracking part.
//    The gratis flyer uses src=gratis so its scans can be told apart in server logs.
const urlText = url.replace(/^https?:\/\//, '').replace(/\?src=(qr|gratis)$/, '');
const gratisUrl = url.replace(/([?&]src=)qr\b/, '$1gratis');
const flyers = [
  { name: 'flyer', template: 'flyer.template.html', svg },
  { name: 'flyer-gratis', template: 'flyer-gratis.template.html',
    svg: await QRCode.toString(gratisUrl, { ...qrOptions, type: 'svg' }) },
];
for (const f of flyers) {
  const html = readFileSync(join(promo, f.template), 'utf8')
    .replace('{{QR_SVG}}', f.svg)
    .replace('{{URL_TEXT}}', urlText.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
  writeFileSync(join(out, `${f.name}.html`), html);
}

// 3. PDF via headless Chrome
function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try {
      return execFileSync('which', [name], { encoding: 'utf8' }).trim();
    } catch {}
  }
  const pw = join(homedir(), '.cache', 'ms-playwright'); // Chromium downloaded by Playwright
  if (existsSync(pw)) {
    for (const dir of readdirSync(pw).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
      for (const sub of ['chrome-linux64', 'chrome-linux']) {
        const bin = join(pw, dir, sub, 'chrome');
        if (existsSync(bin)) return bin;
      }
    }
  }
  return null;
}

const chrome = findChrome();
if (chrome) {
  for (const f of flyers) {
    execFileSync(chrome, [
      '--headless', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer',
      `--print-to-pdf=${join(out, `${f.name}.pdf`)}`,
      pathToFileURL(join(out, `${f.name}.html`)).href,
    ], { stdio: 'ignore' });
    console.log(`✔ ${f.name}.pdf`);
  }
} else {
  console.warn('Chrome not found: open the .html files in docs/promo/out/ and use Print → Save as PDF (A4, margins: none).');
}
console.log(`✔ QR + flyer for ${url} in docs/promo/out/`);
