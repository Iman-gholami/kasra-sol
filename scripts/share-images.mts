// Makes the committed JPEG link-preview images in public/images/share/ (messengers show JPEG everywhere; the storefront's
// AVIF/WebP photos are not shown by all of them). Run after changing a demo photo or the home page card:
//   npx tsx scripts/share-images.mts
// The home card uses Estedad; sharp needs it as TTF, converted from src/fonts with Python fontTools
// (pip install fonttools brotli), or pass ESTEDAD_TTF=/path/to/Estedad.ttf.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { OverlayOptions } from 'sharp';
import { shareImage, SHARE_HEIGHT, SHARE_WIDTH } from '../backend/src/admin/image-compress';
import { demoPhotos, studioPhotos } from '../src/data/products';
import { shareImageFor, HOME_SHARE_IMAGE } from '../src/lib/share-image';

const root = join(import.meta.dirname, '..');
// The API's sharp (a dependency of backend/), the same one that makes the share images of uploads.
const sharp = createRequire(join(root, 'backend', 'package.json'))('sharp') as typeof import('sharp');
const out = join(root, 'public');
mkdirSync(join(out, 'images', 'share'), { recursive: true });

for (const src of new Set(Object.values(demoPhotos).flat())) {
  const target = shareImageFor(src)!.url;
  writeFileSync(join(out, target), await shareImage(readFileSync(join(out, src))));
  console.log(target);
}

const font = process.env.ESTEDAD_TTF ?? join(tmpdir(), 'Estedad-VF.ttf');
if (!existsSync(font)) {
  execFileSync('python3', ['-c', 'import sys; from fontTools.ttLib import TTFont; f = TTFont(sys.argv[1]); f.flavor = None; f.save(sys.argv[2])',
    join(root, 'src', 'fonts', 'Estedad-VF.woff2'), font]);
}
const text = (markup: string, size: number, color: string, weight = 'Regular') => sharp({ text: {
  text: '<span foreground="' + color + '">' + markup + '</span>', fontfile: font, font: 'Estedad ' + weight + ' ' + size,
  rgba: true, align: 'right' } }).png().toBuffer({ resolveWithObject: true });

// The home page card: the cover model on the left, the brand on the right (the page reads right to left).
const model = await sharp(join(out, studioPhotos.cover)).resize({ height: 600 }).png().toBuffer({ resolveWithObject: true });
const lines = [
  await text('کسری بوتیک', 96, '#181818', 'Bold'),
  await text('استایل هر روزت، به سبک خودت.', 42, '#3A3A3A'),
  await text('شومیز · مانتو · تیشرت زنانه', 34, '#5E5E5E'),
  await text('kasraboutique.ir', 30, '#B51F2B', 'Medium')
];
const gaps = [0, 28, 22, 48];
const right = SHARE_WIDTH - 90;
let top = 150;
const layers: OverlayOptions[] = [
  { input: model.data, left: 70, top: SHARE_HEIGHT - model.info.height },
  { input: { create: { width: 72, height: 6, channels: 4, background: '#B51F2B' } }, left: right - 72, top: top - 34 }
];
lines.forEach((line, i) => {
  top += gaps[i];
  layers.push({ input: line.data, left: right - line.info.width, top });
  top += line.info.height;
});
const card = await sharp({ create: { width: SHARE_WIDTH, height: SHARE_HEIGHT, channels: 3, background: '#EAECF0' } })
  .composite(layers).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
writeFileSync(join(out, HOME_SHARE_IMAGE), card);
console.log(HOME_SHARE_IMAGE, Math.round(card.length / 1024) + ' KB');
