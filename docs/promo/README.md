# Promo: QR code + A4 flyer

The printed QR code opens the public page `/welcome`.

```bash
npm run promo -- https://YOUR-DOMAIN/welcome?src=qr
```

This writes to `docs/promo/out/` (not in git, regenerate any time):

| File | Use |
|---|---|
| `flyer.pdf` | A4 flyer, ready to print |
| `flyer.html` | same flyer, open in a browser to preview or print manually |
| `flyer-gratis.pdf` / `.html` | A4 "SKENIRAJ ZA NAGRADE" flyer: big headline, QR below. Its QR (`?src=gratis`) opens `/welcome` with the "Osvojili ste 30 dana gratis" popup |
| `qr.svg` | vector QR code for any other print design |
| `qr.png` | 1024px QR code for messages and social media |

- `?src=qr` is ignored by the app but lets you tell QR visits apart in server logs. It is not printed in the text address.
  The gratis flyer's QR uses `?src=gratis` instead, so you can see which flyer people scanned.
- The PDF needs Chrome or Chromium. If it isn't found, set `CHROME=/path/to/chrome` or print `flyer.html` from the browser
  (A4, margins "None", background graphics on).
- To change the flyer text or layout, edit `flyer.template.html`.

**Before printing:** use the real production domain, then scan the printed test page with a phone.
A QR code cannot be changed after printing, so keep `/welcome` working at that address.
