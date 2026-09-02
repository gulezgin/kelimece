/**
 * Konu grupları.
 *
 * Kelime paketindeki `topic` alanı bugüne kadar yalnızca veride duruyordu;
 * bu modül onu çalışılabilir bir birime çeviriyor. Amaç, sıklık sırasının
 * yanına ikinci bir giriş yolu koymak: "bugün mutfak kelimelerine
 * çalışayım" diyebilmek.
 *
 * Konusu olmayan kelime normaldir — "abandon" hiçbir alana girmez — bu
 * yüzden konusuzlar bir grup olarak gösterilmez, yalnızca sayılır.
 */
import { isLevelUnlocked } from './entitlements.js';
import { MAX_LEVEL } from './srs.js';
import { isDue } from './time.js';

/**
 * Konu başlığı → simge. Yalnızca görünüm; eşleşmeyen konu simgesiz kalır.
 * Paketteki konu adları Türkçe ve sabit; anahtar olarak onlar kullanılıyor.
 */
export const TOPIC_ICONS = {
	'vücut': '🫀',
	'sağlık': '🩺',
	'yiyecek ve içecek': '🍽️',
	'aile': '👨‍👩‍👧',
	'ev': '🏠',
	'giysi': '👕',
	'hayvanlar': '🐾',
	'doğa ve hava': '🌦️',
	'ulaşım': '🚌',
	'yerler': '📍',
	'meslekler': '💼',
	'okul ve iş': '🎓',
	'teknoloji': '💻',
	'sanat ve eğlence': '🎭',
	'toplum': '🏛️',
	'hukuk': '⚖️',
	'duygular': '💭',
	'renkler': '🎨',
	'zaman': '🕐',
	'malzemeler': '🧱',
	'sayılar': '🔢',
	'insanlar': '🧑',
	'bilim': '🔬',
	'medya': '📰',
	'yer ve yön': '🧭',
	'günlük konuşma': '💬',
	'dilbilgisi': '📐',
	'temel fiiller': '⚡',
	'temel sıfatlar': '🏷️',
	'temel kavramlar': '🧩',
	'para ve alışveriş': '💰',
	'iletişim': '✉️',
	'din ve inanç': '🕊️',
	'spor': '⚽',
	'duyular': '👁️',
	'miktar ve ölçü': '📏'
};

/**
 * Bir kelime öğrenilmiş sayılır mı?
 * Ölçüt liste ekranıyla aynı: en üst kutuya ulaşmış olmak.
 */
function isLearned(word) {
	return (word.level || 0) >= MAX_LEVEL;
}

/**
 * Konuları özetler: her konu için toplam, öğrenilmiş ve tekrar bekleyen
 * kelime sayısı.
 *
 * Kilitli seviyedeki kelimeler sayıma girer ama ayrıca `locked` olarak
 * bildirilir; kullanıcı neyi kaçırdığını görmeden abone olmaz.
 *
 * @param {object[]} words
 * @param {object} [premium] Abonelik durumu; verilmezse kilit hesaplanmaz.
 * @returns {{topics: object[], untopiced: number}}
 */
export function topicSummaries(words, premium = null) {
	const map = new Map();
	let untopiced = 0;

	for (const w of words || []) {
		if (!w || !w.topic) {
			untopiced++;
			continue;
		}
		let entry = map.get(w.topic);
		if (!entry) {
			entry = {
				topic: w.topic,
				icon: TOPIC_ICONS[w.topic] || '📗',
				total: 0,
				learned: 0,
				due: 0,
				locked: 0
			};
			map.set(w.topic, entry);
		}
		entry.total++;
		if (isLearned(w)) entry.learned++;
		else if (isDue(w.nextReviewAt)) entry.due++;
		if (premium && w.source !== 'user' && !isLevelUnlocked(w.cefr, premium)) {
			entry.locked++;
		}
	}

	// Büyük konular önce: küçük gruplar tek başına bir oturumu doldurmaz.
	const topics = [...map.values()].sort(
		(a, b) => b.total - a.total || a.topic.localeCompare(b.topic, 'tr')
	);
	return { topics, untopiced };
}

/**
 * Bir konudaki kelimeler.
 * @param {object[]} words
 * @param {string} topic
 */
export function wordsInTopic(words, topic) {
	return (words || []).filter((w) => w && w.topic === topic);
}

/**
 * Konunun tamamlanma oranı (0-100). Boş konuda 0 döner.
 * @param {{total: number, learned: number}} summary
 */
export function topicProgress(summary) {
	if (!summary || !summary.total) return 0;
	return Math.round((summary.learned / summary.total) * 100);
}
