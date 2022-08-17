import fs from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const SRC = path.join(PUBLIC_DIR, 'icon.png');

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writePng(outPath, size) {
  const buf = await sharp(SRC)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await fs.writeFile(outPath, buf);
  return buf;
}

async function main() {
  if (!(await exists(SRC))) {
    console.error(`Error: missing source icon at ${SRC}`);
    console.error('Expected public/icon.png to exist (source-of-truth).');
    process.exit(1);
  }

  await fs.mkdir(PUBLIC_DIR, { recursive: true });

  const created = [];

  // Apple touch icon
  await writePng(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), 180);
  created.push('public/apple-touch-icon.png (180x180)');

  // Optional PWA-ish sizes
  await writePng(path.join(PUBLIC_DIR, 'icon-192.png'), 192);
  created.push('public/icon-192.png (192x192)');

  await writePng(path.join(PUBLIC_DIR, 'icon-512.png'), 512);
  created.push('public/icon-512.png (512x512)');

  // Favicon (ICO) with multiple sizes
  const png16 = await writePng(path.join(PUBLIC_DIR, 'favicon-16.png'), 16);
  const png32 = await writePng(path.join(PUBLIC_DIR, 'favicon-32.png'), 32);
  const png48 = await writePng(path.join(PUBLIC_DIR, 'favicon-48.png'), 48);

  const ico = await pngToIco([png16, png32, png48]);
  await fs.writeFile(path.join(PUBLIC_DIR, 'favicon.ico'), ico);
  created.push('public/favicon.ico (16/32/48)');

  // Clean up intermediate favicon PNGs (keep repo tidy)
  await fs.rm(path.join(PUBLIC_DIR, 'favicon-16.png'), { force: true });
  await fs.rm(path.join(PUBLIC_DIR, 'favicon-32.png'), { force: true });
  await fs.rm(path.join(PUBLIC_DIR, 'favicon-48.png'), { force: true });

  console.log('Generated icons:');
  for (const line of created) console.log(`- ${line}`);
}

main().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
