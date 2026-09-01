/**
 * assets/icon.svg dosyasından PWA ve Android ikonlarını üretir.
 *
 * Çalıştırma: npm run build:icons
 *
 * Üretilenler:
 *   public/icons/icon-{192,512}.png   PWA manifest ikonları
 *   public/icons/maskable-512.png     Android adaptif ikon (güvenli alan payı)
 *   public/icons/apple-touch-icon.png iOS ana ekran
 *   public/favicon.png
 *   assets/generated/icon-1024.png    Capacitor/@capacitor-assets kaynağı
 *   assets/generated/splash-*.png     Açılış ekranı (açık ve koyu)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'assets/icon.svg');

const PUBLIC_ICONS = join(ROOT, 'public/icons');
const GENERATED = join(ROOT, 'assets/generated');
mkdirSync(PUBLIC_ICONS, { recursive: true });
mkdirSync(GENERATED, { recursive: true });

const svg = readFileSync(SOURCE);
const BG = '#0f1320';

/** Arka planı belirgin bir renkle doldurup PNG yazar. */
async function render(size, outPath, { padding = 0, background = BG } = {}) {
	const inner = Math.round(size * (1 - padding * 2));
	const icon = await sharp(svg, { density: 400 }).resize(inner, inner).png().toBuffer();

	const image = sharp({
		create: { width: size, height: size, channels: 4, background }
	}).composite([{ input: icon, gravity: 'center' }]);

	await image.png().toFile(outPath);
	return outPath;
}

/** Açılış ekranı: ortada ikon, geri kalanı düz renk. */
async function splash(width, height, outPath, background) {
	const iconSize = Math.round(Math.min(width, height) * 0.28);
	const icon = await sharp(svg, { density: 400 }).resize(iconSize, iconSize).png().toBuffer();

	await sharp({ create: { width, height, channels: 4, background } })
		.composite([{ input: icon, gravity: 'center' }])
		.png()
		.toFile(outPath);
	return outPath;
}

const written = [];

// --- PWA ---
written.push(await render(192, join(PUBLIC_ICONS, 'icon-192.png')));
written.push(await render(512, join(PUBLIC_ICONS, 'icon-512.png')));
// Maskable: Android ikonu daire/kare maskeyle kırpar, kenarlarda pay gerekir.
written.push(await render(512, join(PUBLIC_ICONS, 'maskable-512.png'), { padding: 0.14 }));
written.push(await render(180, join(PUBLIC_ICONS, 'apple-touch-icon.png')));
written.push(await render(64, join(ROOT, 'public/favicon.png')));

// --- Capacitor kaynak dosyaları ---
written.push(await render(1024, join(GENERATED, 'icon-1024.png')));
// Adaptif ikonun ön planı: şeffaf arka plan, %14 pay
{
	const inner = Math.round(1024 * 0.72);
	const icon = await sharp(svg, { density: 400 }).resize(inner, inner).png().toBuffer();
	const out = join(GENERATED, 'icon-foreground-1024.png');
	await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
		.composite([{ input: icon, gravity: 'center' }])
		.png()
		.toFile(out);
	written.push(out);
}
written.push(await splash(2732, 2732, join(GENERATED, 'splash-2732.png'), BG));
written.push(await splash(2732, 2732, join(GENERATED, 'splash-2732-dark.png'), '#080b14'));

console.log('Üretilen dosyalar:');
for (const f of written) console.log('  ' + f.replace(ROOT, '.').replace(/\\/g, '/'));
