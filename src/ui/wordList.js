/**
 * Kelime listesi, kutular görünümü ve istatistik çubuğu.
 *
 * Bu modül durumu değiştirmez; olayları dışarıdan verilen geri çağrılara
 * (callbacks) iletir. Böylece render mantığı veri mantığından ayrı kalır.
 */
import { hasEnglishVoice, speak } from '../core/speech.js';
import { isDue } from '../core/time.js';
import { MAX_LEVEL } from '../core/srs.js';
import { $, el } from './dom.js';

/**
 * Arama ve filtreye göre kelimeleri süzer.
 * @param {object[]} words
 * @param {{query?: string, mode?: string, cefr?: string, topic?: string}} filter
 */
export function filterWords(words, { query = '', mode = 'all', cefr = 'all', topic = null }) {
	let list = words;

	// Konu suzgeci en dista: secili konu disindaki hicbir kelime
	// digerleri hesaplanirken de sayilmasin.
	if (topic) list = list.filter((w) => w.topic === topic);

	// Seviye süzgeci önce uygulanır: diğer sayaçlar da seçilen seviyeye göre
	// anlam kazansın diye.
	if (cefr && cefr !== 'all') {
		list = cefr === 'none' ? list.filter((w) => !w.cefr) : list.filter((w) => w.cefr === cefr);
	}

	if (mode === 'due') list = list.filter((w) => w.level < MAX_LEVEL && isDue(w.nextReviewAt));
	else if (mode === 'new') list = list.filter((w) => w.source === 'user' && isToday(w.addedAt));
	else if (mode === 'learned') list = list.filter((w) => w.level >= MAX_LEVEL);

	const q = foldTr(query.trim());
	if (q) {
		list = list.filter(
			(w) =>
				foldTr(w.en).includes(q) ||
				foldTr(w.tr).includes(q) ||
				(w.synonyms || []).some((x) => foldTr(x).includes(q)) ||
				(w.tags || []).some((t) => foldTr(t).includes(q))
		);
	}
	return list;
}

function isToday(iso) {
	return new Date(iso).toDateString() === new Date().toDateString();
}

/**
 * Arama icin metni sadelestirir: kucuk harfe cevirir ve Turkce aksanlari
 * duz karsiliklarina indirger.
 *
 * Neden: kullanici "yag" yazip "yagi" bulabilmeli, "ogrenmek" yazip
 * "ogrenmek" bulabilmeli. Turkce klavyeye gecmeden arama yapmak yaygin.
 * Ozel durum: 'I'.toLowerCase() Turkce yerelde 'i' vermez, bu yuzden
 * donusum tablosu buyuk harfleri de kapsiyor.
 */
const FOLD = {
	ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', I: 'i', İ: 'i', i: 'i',
	ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u'
};

export function foldTr(text) {
	let out = '';
	for (const ch of String(text || '')) out += FOLD[ch] || ch.toLowerCase();
	return out;
}

/**
 * Üst rozetler ve havuz sayaçları.
 * @param {{total: number, due: number, learned: number, addedToday: number}} stats
 * @param {number} visibleCount
 * @param {number} dailyGoal
 */
export function renderStats(stats, visibleCount, dailyGoal) {
	$('statTotal').textContent = 'Toplam: ' + stats.total;
	$('statDue').textContent = 'Bugün tekrar: ' + stats.due;
	$('statAdded').textContent = `Bugün eklendi: ${stats.addedToday} / ${dailyGoal}`;
	$('listInfo').textContent = visibleCount + ' sonuç';
	$('poolCountAll').textContent = String(stats.total);
	$('poolCountDue').textContent = String(stats.due);
	$('poolCountNew').textContent = String(stats.addedToday);
	$('poolCountLearned').textContent = String(stats.learned);
}

/**
 * Ilk cizimde gosterilecek kart sayisi ve her kaydirmada eklenecek miktar.
 *
 * 2493 kartin tamamini birden cizmek 43.900 DOM dugumu ve ~124ms
 * demekti; telefonda bunun uc-dort kati. Her tus vurusunda liste
 * yeniden ciziliyor, yani arama gorunur sekilde takiliyordu.
 */
const CHUNK_SIZE = 60;

/** Kaydirma gozlemcisi; her yeni cizimde yenileniyor. */
let listObserver = null;

/**
 * Kart listesi. Gorunur alan kadarini cizer, kaydirdikca devamini ekler.
 *
 * Gercek sanallastirma (gorunmez olani DOM'dan cikarma) yerine kademeli
 * ekleme secildi: kart yukseklikleri degisken oldugu icin sanallastirma
 * kaydirma cubugunu zipilatir, kademeli ekleme ise fark edilmez.
 *
 * @param {object[]} list
 * @param {{onKnown: Function, onForgot: Function, onLearn: Function, onDelete: Function, onTagClick: Function}} handlers
 */
export function renderList(list, handlers) {
	const container = $('list');
	container.textContent = '';

	if (listObserver) {
		listObserver.disconnect();
		listObserver = null;
	}

	if (!list.length) {
		container.appendChild(
			el('div', { class: 'small', text: 'Hiç sonuç yok. Filtreleri temizlemeyi veya yeni kelime eklemeyi deneyin.' })
		);
		return;
	}

	let rendered = 0;

	const sentinel = el('div', { class: 'listSentinel' });

	function renderChunk() {
		const end = Math.min(rendered + CHUNK_SIZE, list.length);
		const frag = document.createDocumentFragment();
		for (let i = rendered; i < end; i++) frag.appendChild(wordCard(list[i], handlers));
		container.insertBefore(frag, sentinel);
		rendered = end;

		if (rendered >= list.length) {
			sentinel.remove();
			if (listObserver) {
				listObserver.disconnect();
				listObserver = null;
			}
		} else {
			sentinel.textContent = `${rendered} / ${list.length} gösteriliyor…`;
		}
	}

	container.appendChild(sentinel);
	renderChunk();

	if (rendered < list.length) {
		if (typeof IntersectionObserver === 'undefined') {
			// Destek yoksa hepsini ciz - dogruluk performanstan once gelir
			while (rendered < list.length) renderChunk();
			return;
		}
		listObserver = new IntersectionObserver((entries) => {
			if (entries.some((e) => e.isIntersecting)) renderChunk();
		}, { rootMargin: '400px' });
		listObserver.observe(sentinel);
	}
}

function wordCard(w, { onKnown, onForgot, onLearn, onDelete, onTagClick }) {
	const learned = w.level >= MAX_LEVEL;
	const due = isDue(w.nextReviewAt);

	const speakBtn = hasEnglishVoice()
		? el('button', { class: 'speakBtn speakBtn--sm', text: '🔊', title: 'Telaffuzu dinle' })
		: null;
	if (speakBtn) {
		speakBtn.onclick = (e) => {
			e.stopPropagation();
			speak(w.en);
		};
	}

	const top = el('div', { class: 'top' }, [
		el('div', { class: 'en', text: w.en }),
		speakBtn,
		el('div', { class: 'tr', text: '— ' + w.tr }),
		el('div', { class: 'spacer' }),
		w.cefr ? el('span', { class: 'cefr cefr--' + w.cefr, text: w.cefr }) : null,
		w.pos ? el('span', { class: 'posTag', text: POS_LABELS[w.pos] || w.pos }) : null,
		el('span', { class: 'kpill', text: 'Seviye ' + w.level }),
		el('span', {
			class: 'badge ' + (learned ? 'ok' : due ? 'warn' : ''),
			text: learned ? 'Öğrenilmiş' : due ? 'Tekrar zamanı' : 'Sırada değil'
		})
	]);

	const card = el('div', { class: 'item' }, [top]);

	if (w.tags.length) {
		const tags = el('div', { class: 'tags' });
		for (const t of w.tags) {
			const tag = el('span', { class: 'tag', text: t, title: 'Bu etikete göre filtrele' });
			tag.addEventListener('click', () => onTagClick(t));
			tags.appendChild(tag);
		}
		card.appendChild(tags);
	}

	if (w.synonyms && w.synonyms.length) {
		card.appendChild(el('div', { class: 'small', text: 'Eş anlamlı: ' + w.synonyms.join(', ') }));
	}
	if (w.example) {
		const box = el('div', { class: 'exampleBox exampleBox--card' }, [
			el('div', { class: 'exampleEn', text: w.example }),
			w.exampleTr ? el('div', { class: 'exampleTr', text: w.exampleTr }) : null
		]);
		card.appendChild(box);
	}

	const knowBtn = el('button', { class: 'good', text: 'Biliyordum ✓' });
	knowBtn.onclick = () => onKnown(w.id);
	const failBtn = el('button', { class: 'bad', text: 'Unuttum ✗' });
	failBtn.onclick = () => onForgot(w.id);
	const learnBtn = el('button', { class: 'ghost', text: 'Öğrenilmişe al' });
	learnBtn.onclick = () => onLearn(w.id);
	const delBtn = el('button', { class: 'ghost', text: 'Sil' });
	delBtn.onclick = () => onDelete(w.id, w.en);

	const actions = el('div', { class: 'actions' }, [knowBtn, failBtn]);
	if (!learned) actions.appendChild(learnBtn);
	actions.appendChild(delBtn);
	card.appendChild(actions);

	return card;
}

/**
 * Kutular görünümü — kart listesiyle AYNI filtrelenmiş listeyi kullanır.
 * @param {object[]} list
 */
export function renderTiles(list) {
	const tiles = $('meanTiles');
	if (!tiles) return;
	tiles.textContent = '';

	const frag = document.createDocumentFragment();
	const sorted = list.slice().sort((a, b) => a.en.localeCompare(b.en, 'en', { sensitivity: 'base' }));
	// Kutular kart listesinden cok daha hafif (2 dugum), ama yine de
	// binlercesi birikmesin.
	const limited = sorted.slice(0, 600);
	for (const w of limited) {
		frag.appendChild(
			el('div', { class: 'tile' }, [
				el('div', { class: 'tileTop' }, [
					el('div', { class: 'en', text: w.en }),
					w.cefr ? el('span', { class: 'cefr cefr--' + w.cefr, text: w.cefr }) : null
				]),
				el('div', { class: 'tr', text: w.tr })
			])
		);
	}
	tiles.appendChild(frag);

	if (sorted.length > limited.length) {
		tiles.appendChild(el('div', {
			class: 'small listSentinel',
			text: `İlk ${limited.length} kelime gösteriliyor (toplam ${sorted.length}). Aramayla daraltabilirsin.`
		}));
	}
}

/** Sözcük türlerinin Türkçe karşılıkları. */
export const POS_LABELS = {
	noun: 'isim',
	verb: 'fiil',
	adjective: 'sıfat',
	adverb: 'zarf',
	pronoun: 'zamir',
	preposition: 'edat',
	conjunction: 'bağlaç',
	determiner: 'belirteç',
	number: 'sayı',
	ordinal: 'sıra sayı',
	'phrasal verb': 'öbek fiil',
	phrase: 'kalıp'
};

/** CEFR seviyeleri, öğrenme sırasıyla. */
export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * Seviye başına toplam ve öğrenilmiş sayısını hesaplar.
 * @param {object[]} words
 * @param {number} maxLevel Öğrenilmiş sayılan SRS seviyesi
 */
export function levelBreakdown(words, maxLevel) {
	const stats = {};
	for (const key of [...CEFR_ORDER, 'none']) stats[key] = { total: 0, learned: 0, due: 0 };

	for (const w of words) {
		const key = w.cefr || 'none';
		const bucket = stats[key];
		if (!bucket) continue;
		bucket.total++;
		if (w.level >= maxLevel) bucket.learned++;
	}
	return stats;
}

/**
 * Seviye seçici düğmelerini çizer.
 * @param {object} breakdown levelBreakdown() çıktısı
 * @param {string} active Seçili seviye ('all' | 'A1'... | 'none')
 * @param {(level: string) => void} onSelect
 */
export function renderLevelBar(breakdown, active, onSelect, lockedLevels = new Set()) {
	const bar = $('levelBar');
	if (!bar) return;
	bar.textContent = '';

	const total = CEFR_ORDER.reduce((sum, l) => sum + breakdown[l].total, 0) + breakdown.none.total;
	const buttons = [{ key: 'all', label: 'Tümü', count: total }];
	for (const l of CEFR_ORDER) buttons.push({ key: l, label: l, count: breakdown[l].total });
	if (breakdown.none.total) buttons.push({ key: 'none', label: '—', count: breakdown.none.total });

	const frag = document.createDocumentFragment();
	for (const b of buttons) {
		if (!b.count && b.key !== 'all') continue;
		const isLocked = lockedLevels.has(b.key);
		const btn = el('button', {
			class: 'levelBtn' + (b.key === active ? ' active' : '')
				+ (b.key !== 'all' ? ' cefr--' + b.key : '')
				+ (isLocked ? ' levelBtn--locked' : ''),
			title: isLocked ? 'Abonelikle açılır' : '',
			attrs: { 'aria-pressed': String(b.key === active) }
		}, [
			el('span', { class: 'levelBtnLabel', text: b.label }),
			el('span', { class: 'levelBtnCount', text: String(b.count) }),
			isLocked ? el('span', { class: 'levelLock', text: '🔒' }) : null
		]);
		btn.onclick = () => onSelect(b.key);
		frag.appendChild(btn);
	}
	bar.appendChild(frag);
}

/**
 * Seçili seviyenin ilerleme özeti.
 * @param {object} breakdown
 * @param {string} active
 */
export function renderLevelInfo(breakdown, active) {
	const node = $('levelInfo');
	if (!node) return;

	if (active === 'all') {
		const parts = CEFR_ORDER
			.filter((l) => breakdown[l].total)
			.map((l) => `${l} %${Math.round((breakdown[l].learned / breakdown[l].total) * 100)}`);
		node.textContent = parts.length ? 'Öğrenilme oranı — ' + parts.join('  ·  ') : '';
		return;
	}

	const b = breakdown[active];
	if (!b || !b.total) {
		node.textContent = '';
		return;
	}
	const pct = Math.round((b.learned / b.total) * 100);
	const label = active === 'none' ? 'Seviyesiz' : active;
	node.textContent = `${label}: ${b.total} kelime, ${b.learned} tanesi öğrenilmiş (%${pct})`;
}
