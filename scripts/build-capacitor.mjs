/**
 * Capacitor için web build alır.
 *
 * Farkı: servis çalışanı üretilmez. Capacitor'ın WebView'ünde varlıklar
 * zaten cihazda olduğu için servis çalışanı gereksiz; ayrıca eski bir
 * önbelleği tutup güncellemeleri gizleyebiliyor.
 *
 * CAP ortam değişkenini burada set etmek, Windows/macOS/Linux arasında
 * `CAP=1 vite build` sözdizimi farkını ortadan kaldırıyor.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const result = spawnSync('npx', ['vite', 'build'], {
	cwd: ROOT,
	stdio: 'inherit',
	shell: true,
	env: { ...process.env, CAP: '1' }
});

process.exit(result.status ?? 1);
