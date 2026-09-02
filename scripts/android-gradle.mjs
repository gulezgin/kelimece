/**
 * Gradle görevini doğru ortamla çalıştırır.
 *
 * İki Windows tuzağını kapatıyor. İkisi de kullanıcı adında ASCII
 * dışı harf olmasından kaynaklanıyor ve ikisi de sessizce değil,
 * anlaşılmaz hatalarla patlıyor:
 *
 *  - TEMP: ASCII dışı kullanıcı adında Windows TEMP'i 8.3 kısa
 *    biçimde tutuyor. JDK 17+ selector borusu için AF_UNIX soketini
 *    TEMP altında otomatik adlandırıyor; Windows AF_UNIX connect()
 *    kısa yolu bind edilen adla eşleştiremiyor ve Gradle daemon hiç
 *    başlamıyor ("Unable to establish loopback connection").
 *
 *  - JAVA_HOME: Capacitor 8 eklentileri Java 21 istiyor. Sistemde
 *    birden çok JDK varsa Gradle yanlışını seçip "Cannot find a Java
 *    installation ... languageVersion=21" diyor.
 *
 * Kullanım: node scripts/android-gradle.mjs assembleDebug
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = join(ROOT, 'android');

/** Yol yalnızca yazdırılabilir ASCII mi? */
function isAscii(s) {
	for (const ch of s) {
		const c = ch.charCodeAt(0);
		if (c < 32 || c > 126) return false;
	}
	return true;
}

/**
 * Güvenli bir geçici dizin verir.
 * Mevcut TEMP hem ASCII hem de kısa ad içermiyorsa dokunmuyoruz —
 * gereksiz yere kullanıcının ortamını değiştirmeyelim.
 */
function safeTmp() {
	const current = tmpdir();
	if (isAscii(current) && !current.includes('~')) return null;
	const fallback = 'C:/AndroidBuildTmp';
	mkdirSync(fallback, { recursive: true });
	return fallback;
}

/** Java 21 kurulumunu arar. Bulamazsa null döner. */
function findJdk21() {
	const current = process.env.JAVA_HOME;
	if (current && current.includes('21')) return current;
	const roots = [
		'C:/Program Files/Eclipse Adoptium',
		'C:/Program Files/Microsoft',
		'C:/Program Files/Java'
	];
	for (const root of roots) {
		if (!existsSync(root)) continue;
		for (const name of readdirSync(root)) {
			if (!name.includes('21')) continue;
			const candidate = join(root, name);
			if (existsSync(join(candidate, 'bin', 'java.exe'))) return candidate;
		}
	}
	return null;
}

const task = process.argv[2];
if (!task) {
	console.error('Kullanim: node scripts/android-gradle.mjs <gradle-gorevi>');
	process.exit(1);
}

const env = { ...process.env };

const tmp = safeTmp();
if (tmp) {
	env.TEMP = tmp;
	env.TMP = tmp;
	console.log(`  TEMP -> ${tmp}  (ASCII disi / kisa yol duzeltmesi)`);
}

const jdk = findJdk21();
if (jdk) {
	env.JAVA_HOME = jdk;
	console.log(`  JAVA_HOME -> ${jdk}`);
} else {
	console.error('\nJava 21 bulunamadi. Capacitor 8 eklentileri Java 21 istiyor.');
	console.error('Kurmak icin:  winget install EclipseAdoptium.Temurin.21.JDK\n');
	process.exit(1);
}

console.log(`  gradlew ${task}\n`);
// Mutlak yol sart: shell:true ile komut cwd'de degil PATH'te araniyor.
const gradlew = JSON.stringify(join(ANDROID, 'gradlew.bat'));
const result = spawnSync(gradlew, [task], {
	cwd: ANDROID,
	stdio: 'inherit',
	shell: true,
	env
});
process.exit(result.status ?? 1);
