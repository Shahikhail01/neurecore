/**
 * generate-icons.mjs
 * ------------------------------------------------------------------
 * Generates all PWA PNG icons from the master SVG source.
 * Requires: sharp   →  npm install --save-dev sharp
 * Run:      node scripts/generate-icons.mjs
 */

import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC  = resolve(ROOT, 'public/icons/icon.svg');
const DEST = resolve(ROOT, 'public/icons');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function main() {
  let sharp;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    sharp = (await import('sharp')).default;
  } catch {
    console.error(
      '❌  sharp is not installed. Run:\n' +
      '    npm install --save-dev sharp\n' +
      '  or\n' +
      '    pnpm add -D sharp',
    );
    process.exit(1);
  }

  mkdirSync(DEST, { recursive: true });
  const svgBuffer = readFileSync(SRC);

  await Promise.all(
    SIZES.map((size) =>
      sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(resolve(DEST, `icon-${size}.png`))
        .then(() => console.log(`✅  icon-${size}.png`))
        .catch((err) => console.error(`❌  icon-${size}.png →`, err.message)),
    ),
  );

  console.log('\n🎉  All icons generated in public/icons/');
}

main();
