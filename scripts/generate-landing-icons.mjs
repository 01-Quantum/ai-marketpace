/**
 * Extract landing-page icons directly from design-pages/page-1.png.
 * Pixels with a near-black background are made transparent so the icons
 * blend onto the app's dark cards regardless of exact background shade.
 */
import sharp from 'sharp';
import { mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '../design-pages/page-1.png');
const OUT = join(__dirname, '../public/landing-icons');

/**
 * Crop boxes are calibrated against the 1672 x 941 source PNG.
 * [left, top, width, height] – the area is square-padded and resized
 * to a uniform size on output.
 */
/**
 * Helper: build a square crop box from a centre point + half-extent.
 */
function center(cx, cy, w, h) {
  return [Math.round(cx - w / 2), Math.round(cy - h / 2), w, h];
}

const crops = {
  'logo-shield':         { box: center(46,   46,  62, 62), size: 96 },
  'user-circle':         { box: center(1613, 50, 42, 46), size: 96 },
  'badge-shield':        { box: center(1105, 48, 28, 30), size: 64 },

  person:                { box: center(875,  170, 30, 28), size: 64 },
  building:              { box: center(1058, 170, 30, 28), size: 64 },

  key:                   { box: center(180,  340, 80, 92), size: 128 },
  'document-lock':       { box: center(500,  340, 68, 88), size: 128 },
  'cloud-chip-lock':     { box: center(825,  340, 96, 80), size: 128 },
  padlock:               { box: center(1124, 340, 68, 88), size: 128 },

  'flow-arrow':          { box: center(340,  367, 32, 20), size: 64 },

  'decision-tree':       { box: center(135,  750, 78, 78), size: 96 },
  'logistic-regression': { box: center(515,  750, 78, 70), size: 96 },

  'check-circle':        { box: center(418,  710, 48, 48), size: 64 },
  'circle-outline':      { box: center(808,  712, 44, 44), size: 64 },

  'hint-lock':           { box: center(903,  650, 44, 46), size: 64 },
  'arrow-right':         { box: center(1200, 745, 32, 22), size: 64 },

  'sidebar-key':         { box: center(1395, 265, 52, 36), size: 64 },
  'sidebar-doc':         { box: center(1395, 358, 50, 56), size: 64 },
  'sidebar-cloud':       { box: center(1395, 456, 56, 54), size: 64 },
  'sidebar-lock':        { box: center(1395, 580, 46, 50), size: 64 },
  'sidebar-callout':     { box: center(1362, 738, 58, 56), size: 64 },

  'footer-shield':       { box: center(108,  875, 56, 50), size: 64 },
  'footer-lock':         { box: center(628,  870, 50, 56), size: 64 },
  'footer-key':          { box: center(1120, 877, 80, 50), size: 64 },
};

/**
 * Convert near-black source pixels to transparent. We keep the original
 * teal / coral colours and use the maximum colour channel as an alpha
 * proxy so anti-aliased edges stay smooth.
 */
async function extractIcon(box, size) {
  const [left, top, width, height] = box;
  const { data, info } = await sharp(SRC)
    .extract({ left, top, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const side = Math.max(info.width, info.height);
  const padX = Math.floor((side - info.width) / 2);
  const padY = Math.floor((side - info.height) / 2);

  const out = Buffer.alloc(side * side * 4, 0);
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const srcIdx = (y * info.width + x) * 4;
      const dstIdx = ((y + padY) * side + (x + padX)) * 4;
      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];
      const maxC = Math.max(r, g, b);
      const alpha = Math.max(0, Math.min(255, Math.round((maxC - 24) * 1.35)));
      out[dstIdx] = r;
      out[dstIdx + 1] = g;
      out[dstIdx + 2] = b;
      out[dstIdx + 3] = alpha;
    }
  }

  const pngBuf = await sharp(out, {
    raw: { width: side, height: side, channels: 4 },
  })
    .resize(size, size, { fit: 'fill' })
    .png()
    .toBuffer();
  return pngBuf;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const [name, { box, size }] of Object.entries(crops)) {
  const buf = await extractIcon(box, size);
  await sharp(buf).toFile(join(OUT, `${name}.png`));
}

console.log(`Wrote ${Object.keys(crops).length} icons to public/landing-icons/`);
