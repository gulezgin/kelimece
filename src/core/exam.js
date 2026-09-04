/**
 * Sınav modu (IELTS / TOEFL).
 *
 * Bu modun YAPMADIĞI şey en baştan söylenmeli: puan vermiyor. Bant
 * ya da TOEFL puanı, eğitimli değerlendiricilerin ölçekli kararı;
 * cihazda çalışan bir kural motoruyla taklit edilemez. Uydurma bir
 * "Bant 6.5" göstermek, sınava hazır olduğunu sanan bir kullanıcının
 * parasını ve zamanını kaybettirir.
 *
 * Yapabildikleri gerçek ve az: sınav biçimini anlatmak, gerçek görev
 * formatında yazdırmak (yerel kontrol + örnek cevapla karşılaştırma),
 * konuşma görevlerini gerçek süreleriyle çalıştırmak ve sınava özgü
 * kelimeleri kişisel listeye aktarmak.
 *
 * Yazma görevleri `core/writing.js` motorunu kullanıyor; ayrı bir
 * kontrol yazmak iki kod yolunun zamanla ayrışmasına yol açardı.
 *
 * Saf mantık: depoya ve DOM'a dokunmaz.
 */

import { isLevelUnlocked } from './entitlements.js';

/** Sınav kimliğine göre içerik süzer; 'both' her ikisine de girer. */
function forExam(list, examId) {
	return (list || []).filter((x) => x.exam === examId || x.exam === 'both');
}

/** Sınav tanımını bulur. */
export function findExam(pack, examId) {
	return ((pack && pack.exams) || []).find((e) => e.id === examId) || null;
}

/** Sınav listesi; her birinin içerik sayıları ile. */
export function examSummaries(pack) {
	const p = pack || {};
	return (p.exams || []).map((e) => ({
		id: e.id,
		name: e.name,
		icon: e.icon,
		summary: e.summary,
		scale: e.scale,
		writing: forExam(p.writing, e.id).length,
		speaking: forExam(p.speaking, e.id).length,
		vocabulary: forExam(p.vocabulary, e.id).length
	}));
}

/** Bir sınavın tüm içeriği. */
export function examContent(pack, examId) {
	const p = pack || {};
	const exam = findExam(p, examId);
	if (!exam) return null;
	return {
		exam,
		writing: forExam(p.writing, examId),
		speaking: forExam(p.speaking, examId),
		vocabulary: forExam(p.vocabulary, examId)
	};
}

/** Konuşma görevini bulur. */
export function findSpeakingTask(pack, id) {
	return ((pack && pack.speaking) || []).find((t) => t.id === id) || null;
}

/** Kelime setini bulur. */
export function findVocabSet(pack, id) {
	return ((pack && pack.vocabulary) || []).find((v) => v.id === id) || null;
}

/**
 * Sınav içeriği kilitli mi.
 *
 * Sınav görevleri B2–C1 seviyesinde; ücretsiz katmanda kilitliler.
 * Kilit kararı yine `entitlements.js` üzerinden veriliyor — ikinci bir
 * kilit mantığı yazmak, kural değiştiğinde birinin unutulması demek.
 */
export function isExamTaskUnlocked(task, premium, now = new Date()) {
	return isLevelUnlocked((task && task.level) || 'C1', premium, now);
}

/**
 * Konuşma görevi için saniye sayacı adımları.
 *
 * Hazırlık ve konuşma ayrı iki aşama; tek bir geri sayım kullanıcının
 * ne zaman konuşmaya başlayacağını bilmemesine yol açıyor.
 */
export function speakingPhases(task) {
	if (!task) return [];
	return [
		{ id: 'prep', label: 'Hazırlık', seconds: Math.max(0, Number(task.prepSeconds) || 0) },
		{ id: 'talk', label: 'Konuşma', seconds: Math.max(1, Number(task.talkSeconds) || 60) }
	].filter((p) => p.seconds > 0);
}

/** Saniyeyi dakika:saniye biçimine çevirir. */
export function formatClock(seconds) {
	const s = Math.max(0, Math.round(Number(seconds) || 0));
	const dk = Math.floor(s / 60);
	const sn = s % 60;
	return `${dk}:${String(sn).padStart(2, '0')}`;
}

/** İçerik dosyasını indirir. */
export async function loadExams(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error('Sınav içeriği yüklenemedi');
	return res.json();
}
