/**
 * Uygulama girişi: modülleri birbirine bağlar ve olayları dinler.
 *
 * Burada iş mantığı yoktur — sadece "kullanıcı şunu yaptı -> store'daki
 * şu fonksiyonu çağır -> ekranı tazele" eşlemesi.
 */
import './styles/main.css';

import { buildReviewQueue, MAX_LEVEL } from './core/srs.js';
import { isDue } from './core/time.js';
import { createWord } from './core/word.js';
import * as store from './data/store.js';
import { alertDialog, confirmDialog, toast } from './ui/dialog.js';
import { $, debounce } from './ui/dom.js';
import * as review from './ui/review.js';
import { filterWords, renderList, renderStats, renderTiles } from './ui/wordList.js';

/** İlk açılışta yüklenecek başlangıç kelime seti. */
const SEED_URL = import.meta.env.BASE_URL + 'content/seed-vocabulary.json';

/** @type {'cards'|'tiles'} */
let activeView = 'cards';

// ===================== Render =====================

function render() {
	const list = filterWords(store.state.words, {
		query: $('search').value,
		mode: $('filterDue').value
	});

	renderStats(store.getStats(isDue), list.length, store.state.settings.dailyGoal);

	// Sadece görünür olan görünümü çiz — 1600+ kelimede ikisini birden
	// çizmek her tuş vuruşunda gereksiz DOM işi demek.
	if (activeView === 'cards') renderList(list, listHandlers);
	else renderTiles(list);
}

const listHandlers = {
	onKnown: (id) => store.markResult(id, true),
	onForgot: (id) => store.markResult(id, false),
	onLearn: (id) => store.markLearned(id),
	onDelete: async (id, en) => {
		const ok = await confirmDialog(`"${en}" kelimesi silinsin mi?`, {
			title: 'Kelimeyi sil',
			confirmText: 'Sil',
			danger: true
		});
		if (ok) {
			store.deleteWord(id);
			toast('Kelime silindi.');
		}
	},
	onTagClick: (tag) => {
		$('search').value = tag;
		render();
	}
};

// ===================== Kelime ekleme =====================

function handleAdd() {
	const word = createWord({
		en: $('en').value,
		tr: $('tr').value,
		example: $('example').value,
		tags: $('tags').value
	});

	if (!word) {
		toast('İngilizce kelime ve Türkçe anlam zorunlu.', 'warn');
		return;
	}

	const result = store.addWord(word);
	if (!result.ok) {
		if (result.reason === 'duplicate') {
			markDuplicate(true);
			toast('Bu kelime havuzda zaten var.', 'warn');
		}
		return;
	}

	clearForm();
	toast(`"${word.en}" eklendi.`);
}

function clearForm() {
	$('en').value = '';
	$('tr').value = '';
	$('example').value = '';
	$('tags').value = '';
	markDuplicate(false);
	$('en').focus();
}

function markDuplicate(isDup) {
	const input = $('en');
	const hint = $('dupHint');
	input.classList.toggle('dup', isDup);
	hint.textContent = isDup ? 'Bu kelime zaten ekli. Aşağıdaki listede görünüyor.' : '';
	hint.classList.toggle('hidden', !isDup);
	hint.classList.toggle('warn', isDup);
}

/** Yazarken hem listeyi süz hem de mükerrer uyarısını göster. */
function onEnglishInput() {
	const value = $('en').value;
	$('search').value = value;
	render();
	markDuplicate(!!value.trim() && store.hasWord(value));
}

// ===================== Tekrar =====================

async function handleStartReview() {
	const free = $('freeReview').checked;
	const queue = buildReviewQueue(store.state.words, { free, isDue });

	if (!queue.length) {
		await alertDialog(
			free
				? 'Tekrar edilecek kelime kalmadı — tüm kelimeler öğrenilmiş görünüyor.'
				: 'Bugün tekrar zamanı gelen kelime yok.\n\nTüm kelimeleri çalışmak için "Serbest tekrar" seçeneğini işaretleyin.',
			{ title: 'Tekrar' }
		);
		return;
	}

	review.startSession(queue, {
		getWord: (id) => store.state.words.find((w) => w.id === id),
		onAnswer: (id, known) => store.markResult(id, known),
		onFinish: async (stats) => {
			render();
			if (stats.answered > 0) {
				const rate = Math.round((stats.known / stats.answered) * 100);
				await alertDialog(
					`${stats.answered} kelime çalışıldı.\n` +
						`Bildiğin: ${stats.known}  ·  Unuttuğun: ${stats.forgot}` +
						(stats.skipped ? `  ·  Geçtiğin: ${stats.skipped}` : '') +
						`\n\nBaşarı oranın: %${rate}`,
					{ title: 'Oturum tamamlandı' }
				);
			}
		}
	});
}

// ===================== Yedekleme =====================

function handleExport() {
	const blob = new Blob([JSON.stringify(store.exportPayload(), null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	const d = new Date();
	const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	a.href = url;
	a.download = `kelime-havuzu-${stamp}.json`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
	toast('Yedek indirildi.');
}

function handleImport(file) {
	const reader = new FileReader();
	reader.onload = async () => {
		try {
			const result = store.mergeImported(JSON.parse(String(reader.result)));
			await alertDialog(
				`${result.added} kelime eklendi.\n${result.skipped} kayıt atlandı (zaten var veya geçersiz).`,
				{ title: 'İçe aktarma tamamlandı' }
			);
		} catch (e) {
			await alertDialog('Dosya okunamadı.\n\n' + (e && e.message ? e.message : ''), { title: 'Hata' });
		}
	};
	reader.onerror = () => alertDialog('Dosya okunamadı.', { title: 'Hata' });
	reader.readAsText(file);
}

// ===================== İlk açılış =====================

/**
 * Havuz boşsa başlangıç kelime setini yükler.
 * Havuzda kelime varsa hiçbir şey yapmaz — kullanıcının verisine dokunmaz.
 */
async function seedIfEmpty() {
	if (store.state.words.length > 0) return;
	try {
		const res = await fetch(SEED_URL, { cache: 'no-store' });
		if (!res.ok) return;
		const result = store.mergeImported(await res.json());
		if (result.added) toast(`${result.added} kelimelik başlangıç seti yüklendi.`);
	} catch {
		// Başlangıç seti bulunamadıysa boş havuzla devam et.
	}
}

// ===================== Olay bağlantıları =====================

function wireEvents() {
	$('addBtn').addEventListener('click', handleAdd);
	$('clearFormBtn').addEventListener('click', clearForm);

	const enterToAdd = (e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleAdd();
		}
	};
	$('en').addEventListener('keydown', enterToAdd);
	$('tr').addEventListener('keydown', enterToAdd);
	$('en').addEventListener('input', debounce(onEnglishInput, 120));

	$('search').addEventListener('input', debounce(render, 150));
	$('filterDue').addEventListener('change', render);

	const setFilter = (value) => () => {
		$('filterDue').value = value;
		render();
	};
	$('poolAllBtn').addEventListener('click', setFilter('all'));
	$('poolDueBtn').addEventListener('click', setFilter('due'));
	$('poolNewBtn').addEventListener('click', setFilter('new'));
	$('poolLearnedBtn').addEventListener('click', setFilter('learned'));

	$('startReviewBtn').addEventListener('click', handleStartReview);

	$('exportBtn').addEventListener('click', handleExport);
	$('importFile').addEventListener('change', (e) => {
		const file = e.target.files[0];
		if (file) handleImport(file);
		e.target.value = '';
	});

	$('tabCards').addEventListener('click', () => switchView('cards'));
	$('tabTiles').addEventListener('click', () => switchView('tiles'));

	$('goalInput').addEventListener('change', (e) => store.setDailyGoal(e.target.value));

	$('resetTodayBtn').addEventListener('click', () => {
		store.resetTodayCounter();
		toast('Günlük sayaç sıfırlandı.');
	});

	$('wipeBtn').addEventListener('click', async () => {
		const ok = await confirmDialog(
			`${store.state.words.length} kelimenin tamamı ve tüm ilerlemen silinecek. Bu işlem geri alınamaz.\n\n` +
				'Devam etmeden önce "JSON Dışa Aktar" ile yedek almanı öneririz.',
			{ title: 'Tüm veriyi sil', confirmText: 'Evet, hepsini sil', danger: true }
		);
		if (ok) {
			store.wipeAll();
			toast('Tüm veri silindi.', 'warn');
		}
	});
}

function switchView(view) {
	activeView = view;
	$('listView').classList.toggle('hidden', view !== 'cards');
	$('tilesView').classList.toggle('hidden', view !== 'tiles');
	$('tabCards').classList.toggle('active', view === 'cards');
	$('tabTiles').classList.toggle('active', view === 'tiles');
	render();
}

// ===================== Başlat =====================

store.setStorageErrorHandler((message) => alertDialog(message, { title: 'Kayıt hatası' }));
store.subscribe(render);

wireEvents();
store.init();
$('goalInput').value = store.state.settings.dailyGoal;
switchView('cards');

seedIfEmpty().finally(render);

// Geliştirme sırasında konsoldan incelemek için
if (import.meta.env.DEV) {
	Object.assign(window, { store, render, MAX_LEVEL, buildReviewQueue, isDue });
}
