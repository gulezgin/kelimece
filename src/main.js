/**
 * Uygulama girişi: modülleri birbirine bağlar ve olayları dinler.
 *
 * Burada iş mantığı yoktur — sadece "kullanıcı şunu yaptı -> store'daki
 * şu fonksiyonu çağır -> ekranı tazele" eşlemesi.
 */
import './styles/main.css';

import { isLevelUnlocked, lockedLevels } from './core/entitlements.js';
import { levelsUpTo } from './core/placement.js';
import { renderTopicChip, renderTopics } from './ui/topics.js';
import { findDialogue, loadDialogues } from './core/dialogues.js';
import { renderDialogue, renderDialogueList } from './ui/dialogues.js';
import { buildReviewQueue, countQueue, MAX_LEVEL } from './core/srs.js';
import { isDue } from './core/time.js';
import * as store from './data/store.js';
import * as notifications from './platform/notifications.js';
import { setupNative } from './platform/native.js';
import { renderDashboard } from './ui/dashboard.js';
import { alertDialog, choiceDialog, confirmDialog, toast } from './ui/dialog.js';
import { $, debounce, el } from './ui/dom.js';
import * as billing from './platform/billing.js';
import * as paywall from './ui/paywall.js';
import { startPlacement } from './ui/placement.js';
import { renderStatsView } from './ui/statsView.js';
import * as review from './ui/review.js';
import {
	filterWords,
	levelBreakdown,
	renderLevelBar,
	renderLevelInfo,
	renderList,
	renderStats,
	renderTiles
} from './ui/wordList.js';

/** Uygulamayla birlikte gelen içerik paketi. */
const PACK_URL = import.meta.env.BASE_URL + 'content/core-v1.json';
const DIALOGUES_URL = import.meta.env.BASE_URL + 'content/dialogues.json';

/** @type {'cards'|'tiles'} */
let activeView = 'cards';

/** Seçili CEFR seviyesi: 'all' | 'A1'..'C2' | 'none' (seviyesiz) */
let activeLevel = 'all';

/** Görünen ana bölüm. */
/** @type {'home'|'stats'|'pool'} */
let activeSection = 'home';

// ===================== Render =====================

/** Seçili seviyedeki kelimeler — hem liste hem tekrar kuyruğu bunu kullanır. */
function wordsAtLevel() {
	return filterWords(store.state.words, { cefr: activeLevel, topic: activeTopic });
}

/** Yuklenen diyaloglar ve acik olanin kimligi. */
let dialogues = [];
let openDialogueId = null;

/**
 * Diyalogda kelimeye dokunulabilmesi icin havuz dizini.
 * Her cizimde 5276 kelime icin yeniden kurmak pahali; kelime sayisi
 * degismedikce yeniden kurulmuyor.
 */
let wordIndexCache = null;
let wordIndexSize = -1;

function getWordIndex() {
	if (wordIndexCache && wordIndexSize === store.state.words.length) return wordIndexCache;
	const map = new Map();
	for (const w of store.state.words) {
		const key = (w.en || '').toLowerCase();
		if (key && !map.has(key)) map.set(key, w);
	}
	wordIndexCache = map;
	wordIndexSize = store.state.words.length;
	return map;
}

/**
 * Havuz ekraninda secili konu. null = konu suzgeci yok.
 * Konu ekranindan "listeye bak" ile gelindiginde doluyor.
 */
let activeTopic = null;

/** Konu suzgecini temizler ve havuza doner. */
function clearTopicFilter() {
	activeTopic = null;
	render();
}

/**
 * Abonelik akışı: paywall aç, satın alma ya da geri yükleme.
 * Satın alma altyapısı henüz Play Billing'e bağlı değil; o durumda
 * paywall bilgilendirme yapıyor ve satın alma denemiyor.
 */
async function openPaywall() {
	await paywall.showPaywall(store.state.words, store.state.profile.premium, {
		onPurchase: async (productId) => {
			const result = await billing.purchase(productId);
			if (result.ok) {
				await store.activatePremium(result.product);
				await alertDialog(
					'Teşekkürler! Tüm seviyelerin kilidi açıldı.',
					{ title: '🔓 Abonelik etkin' }
				);
				render();
				return;
			}
			if (result.reason === 'unavailable') {
				await alertDialog(
					'Satın alma henüz etkin değil.\n\nUygulama Google Play üzerinden ' +
						'kurulduğunda bu ekrandan abone olabileceksin.',
					{ title: 'Yakında' }
				);
			} else if (result.reason !== 'cancelled') {
				await alertDialog('Satın alma tamamlanamadı.', { title: 'Hata' });
			}
		},
		onRestore: async () => {
			const result = await billing.restore();
			if (result.ok) {
				await store.activatePremium(result.product);
				await alertDialog('Aboneliğin geri yüklendi.', { title: 'Tamamlandı' });
				render();
			} else {
				await alertDialog(
					result.reason === 'unavailable'
						? 'Geri yükleme yalnızca Google Play kurulumunda çalışır.'
						: 'Bu hesapta geri yüklenecek bir satın alma bulunamadı.',
					{ title: 'Geri yükleme' }
				);
			}
		}
	});
}

function selectLevel(level) {
	// Kilitli seviyeye tiklamak paywall'i acar
	if (level !== 'all' && level !== 'none'
		&& !isLevelUnlocked(level, store.state.profile.premium)) {
		openPaywall();
		return;
	}
	activeLevel = level;
	render();
}

function render() {
	const breakdown = levelBreakdown(store.state.words, MAX_LEVEL);
	const locked = new Set(lockedLevels(store.state.profile.premium));
	// Abonelik durumunu arayuze bildir
	$('upgradeRow').classList.toggle('hidden', locked.size === 0);

	if (activeSection === 'settings') {
		renderPremiumCard();
		renderStats(store.getStats(isDue), 0, store.state.settings.dailyGoal);
		return;
	}

	if (activeSection === 'stats') {
		// İstatistik profil seviyesi kapsamında; seviye yoksa tüm havuz.
		const scope = store.state.profile.level
			? filterWords(store.state.words, {}).filter((w) => levelsUpTo(store.state.profile.level).includes(w.cefr))
			: store.state.words;
		renderStatsView(scope, store.state.profile);
		// Istatistigin kendi sekmesi yok; geri donus yolu gorunur olmali.
		const host = $('statsView');
		const back = el('button', { class: 'ghost backBtn', text: '← Ana sayfa' });
		back.onclick = () => showSection('home');
		host.insertBefore(back, host.firstChild);
		renderStats(store.getStats(isDue), 0, store.state.settings.dailyGoal);
		return;
	}

	if (activeSection === 'dialogues') {
		const open = openDialogueId ? findDialogue(dialogues, openDialogueId) : null;
		if (open) {
			renderDialogue(open, dialogueHandlers, getWordIndex());
		} else {
			renderDialogueList(dialogues, store.state.profile.premium, dialogueHandlers);
		}
		renderStats(store.getStats(isDue), 0, store.state.settings.dailyGoal);
		return;
	}

	if (activeSection === 'topics') {
		renderTopics(store.state.words, store.state.profile.premium, topicHandlers);
		renderStats(store.getStats(isDue), 0, store.state.settings.dailyGoal);
		return;
	}

	if (activeSection === 'home') {
		// Profil seviyesi varsa özet o seviyeye ve altına odaklanır.
		const scope = store.state.profile.level ? levelsUpTo(store.state.profile.level) : [];
		const overview = store.getOverview(isDue, scope);
		// Ana ekrandaki sayi gercek oturum uzunlugunu gostermeli:
		// 5000 bekleyen kelime degil, bugun calisilacak kadari.
		const scopeWords = scope.length
			? store.state.words.filter((w) => scope.includes(w.cefr))
			: store.state.words;
		overview.session = countQueue(scopeWords, { isDue, newLimit: store.state.settings.dailyGoal });
		renderDashboard(overview, breakdown, dashboardHandlers);
		renderStats(store.getStats(isDue), 0, store.state.settings.dailyGoal);
		return;
	}

	const list = filterWords(store.state.words, {
		query: $('search').value,
		mode: $('filterDue').value,
		cefr: activeLevel,
		topic: activeTopic
	});

	// Konu suzgeci aciksa kullanici bunu gormeli ve kapatabilmeli
	renderTopicChip(activeTopic, list.length, clearTopicFilter);

	// Konu suzgeci aciksa seviye cubugu da o konuyu anlatmali; yoksa
	// rozet "33" derken cubuk "5276" der ve kullanici hangisine
	// inanacagini bilemez.
	const poolBreakdown = activeTopic
		? levelBreakdown(store.state.words.filter((w) => w.topic === activeTopic), MAX_LEVEL)
		: breakdown;

	renderLevelBar(poolBreakdown, activeLevel, selectLevel, locked);
	renderLevelInfo(poolBreakdown, activeLevel);
	renderStats(store.getStats(isDue, wordsAtLevel()), list.length, store.state.settings.dailyGoal);

	// Sadece görünür olan görünümü çiz — 2500 kelimede ikisini birden
	// çizmek her tuş vuruşunda gereksiz DOM işi demek.
	if (activeView === 'cards') renderList(list, listHandlers);
	else renderTiles(list);
}

// ===================== Ana ekran =====================

const dashboardHandlers = {
	/** Ana ekrandan doğrudan çalışmaya başla. */
	onStart: (mode) => {
		const level = store.state.profile.level;
		activeLevel = 'all';
		// Profil seviyesi varsa o seviye ve altını çalış
		const scope = level ? levelsUpTo(level) : null;
		startReviewSession({ free: mode === 'new', levels: scope });
	},
	onPlacement: () => runPlacement(),
	onPickLevel: (level) => {
		if (!isLevelUnlocked(level, store.state.profile.premium)) {
			openPaywall();
			return;
		}
		activeLevel = level;
		showSection('pool');
	},
	onBrowse: () => showSection('pool'),
	onStats: () => showSection('stats')
};

/**
 * Ayarlar ekranindaki abonelik karti.
 * Kilitli icerik varsa satis, yoksa tesekkur gosterir.
 */
function renderPremiumCard() {
	const host = $('premiumCard');
	if (!host) return;
	host.textContent = '';

	const premium = store.state.profile.premium;
	const locked = lockedLevels(premium);

	if (!locked.length) {
		host.appendChild(el('div', { class: 'premiumOn' }, [
			el('span', { class: 'premiumIcon', text: '⭐' }),
			el('div', {}, [
				el('div', { class: 'premiumTitle', text: 'Tüm seviyeler açık' }),
				el('div', { class: 'small', text: 'Aboneliğin etkin. İyi çalışmalar.' })
			])
		]));
		return;
	}

	const btn = el('button', { class: 'premiumBanner' }, [
		el('div', {}, [
			el('div', { class: 'premiumTitle', text: 'Premium özelliğin kilidini aç' }),
			el('div', { class: 'premiumSub', text: locked.join(', ') + ' seviyeleri ve diyaloglar' })
		]),
		el('span', { class: 'premiumStar', text: '⭐' })
	]);
	btn.onclick = () => openPaywall();
	host.appendChild(btn);
}

const dialogueHandlers = {
	onOpen: (id) => {
		openDialogueId = id;
		window.scrollTo(0, 0);
		render();
	},
	onBack: () => {
		openDialogueId = null;
		window.scrollTo(0, 0);
		render();
	},
	onLocked: () => openPaywall(),
	/** Diyalogda kelimeye dokunmak anlamini gosteriyor. */
	onWord: (word) => {
		const parts = [word.tr];
		if (word.cefr) parts.push('Seviye: ' + word.cefr);
		alertDialog(parts.join(String.fromCharCode(10, 10)), { title: word.en });
	}
};

const topicHandlers = {
	/** Konuya dokunmak dogrudan o konuyu calismaya baslatir. */
	onStudy: (topic) => {
		activeTopic = topic;
		startReviewSession({ topic });
	},
	/** Calismak yerine listeye bakmak isteyen icin. */
	onBrowse: (topic) => {
		activeTopic = topic;
		activeLevel = 'all';
		showSection('pool');
	}
};

/** Seviye belirleme testini çalıştırır ve sonucu profile yazar. */
function runPlacement() {
	const words = store.state.words.filter((w) => w.cefr);
	const started = startPlacement(words, {
		onFinish: async (result) => {
			if (!result) return;
			await store.savePlacement(result);
			await alertDialog(
				`Seviyen: ${result.level}\n\n` +
					`${result.asked} soruda ${result.correct} doğru (%${Math.round(result.ratio * 100)}).\n\n` +
					`Artık ana ekrandaki çalışma ${result.level} ve altındaki seviyelere odaklanacak. ` +
					`Bunu istediğin zaman değiştirebilirsin.`,
				{ title: '🎯 Seviye belirlendi' }
			);
			render();
		}
	});
	if (!started) toast('Test için yeterli kelime yok.', 'warn');
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
			await store.deleteWord(id);
			toast('Kelime silindi.');
		}
	},
	onTagClick: (tag) => {
		$('search').value = tag;
		render();
	}
};

// ===================== Kelime ekleme =====================

async function handleAdd() {
	const input = {
		en: $('en').value,
		tr: $('tr').value,
		example: $('example').value,
		tags: $('tags').value
	};

	if (!input.en.trim() || !input.tr.trim()) {
		toast('İngilizce kelime ve Türkçe anlam zorunlu.', 'warn');
		return;
	}

	const result = await store.addWord(input);
	if (!result.ok) {
		if (result.reason === 'duplicate') {
			markDuplicate(true);
			toast('Bu kelime havuzda zaten var.', 'warn');
		}
		return;
	}

	const added = result.word.en;
	clearForm();
	toast(`"${added}" eklendi.`);
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

function handleStartReview() {
	return startReviewSession({ free: $('freeReview').checked });
}

/**
 * Tekrar oturumunu başlatır.
 * @param {{free?: boolean, levels?: string[]|null}} options
 *   levels verilirse yalnızca o CEFR seviyeleri; yoksa havuzdaki seçim.
 */
async function startReviewSession({ free = false, levels = null, topic = null } = {}) {
	// Konu secimi seviye kapsamini gecersiz kilar: kullanici "mutfak"
	// dedigi anda istedigi sey o konunun tamami.
	let pool = topic
		? store.state.words.filter((w) => w.topic === topic)
		: levels
			? store.state.words.filter((w) => levels.includes(w.cefr))
			: wordsAtLevel();

	// Kilitli seviyeler oturuma girmez. Kullanicinin kendi kelimeleri
	// her zaman kalir - kendi verisi kisitlanamaz.
	const before = pool.length;
	pool = pool.filter((w) => w.source === 'user'
		|| isLevelUnlocked(w.cefr, store.state.profile.premium));
	const blocked = before - pool.length;

	if (!pool.length && blocked > 0) {
		openPaywall();
		return;
	}
	// Gunluk hedef = bir oturumda tanistirilacak yeni kelime sayisi.
	const newLimit = store.state.settings.dailyGoal;
	const queue = buildReviewQueue(pool, { free, isDue, newLimit });

	if (!queue.length) {
		const scopeLabel = topic
			? ' (' + topic + ' konusunda)'
			: levels
				? ' (' + levels[levels.length - 1] + ' ve altı)'
				: activeLevel === 'all'
					? ''
					: ' (' + (activeLevel === 'none' ? 'seviyesiz' : activeLevel) + ' seviyesinde)';
		const scope = scopeLabel;
		await alertDialog(
			free
				? 'Tekrar edilecek kelime kalmadı' + scope + ' — tümü öğrenilmiş görünüyor.'
				: 'Bugün tekrar zamanı gelen kelime yok' + scope + '.\n\nTüm kelimeleri çalışmak için "Serbest tekrar" seçeneğini işaretleyin.',
			{ title: 'Tekrar' }
		);
		return;
	}

	review.startSession(queue, {
		// Yanıltıcı seçenekler seçili seviyenin havuzundan üretilir;
		// böylece şıklar benzer zorlukta olur.
		pool: pool.length >= 40 ? pool : store.state.words,
		getWord: (id) => store.getWord(id),
		onRate: (id, rating) => store.rateWord(id, rating),
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
			const r = await store.mergeImported(JSON.parse(String(reader.result)));
			await alertDialog(
				`${r.added} kelime eklendi.\n` +
					`${r.updated} kelimenin ilerlemesi güncellendi.\n` +
					`${r.skipped} kayıt atlandı (zaten güncel veya geçersiz).`,
				{ title: 'İçe aktarma tamamlandı' }
			);
		} catch (e) {
			await alertDialog('Dosya okunamadı.\n\n' + (e && e.message ? e.message : ''), { title: 'Hata' });
		}
	};
	reader.onerror = () => alertDialog('Dosya okunamadı.', { title: 'Hata' });
	reader.readAsText(file);
}

// ===================== İlerleme denetimi =====================

/**
 * "Öğrenilmiş" işaretini hak etmeyen kelimeleri gösterir ve ne yapılacağını
 * kullanıcıya sorar. Hiçbir onarım kullanıcı seçmeden uygulanmaz.
 */
async function handleProgressAudit() {
	const a = store.inspectProgress();

	if (!a.suspect) {
		await alertDialog(
			`"Öğrenilmiş" işaretli ${a.learnedCount} kelimenin hepsi bu etiketi hak ediyor.\nYapılacak bir şey yok.`,
			{ title: 'İlerleme denetimi' }
		);
		return;
	}

	const message =
		`"Öğrenilmiş" işaretli ${a.learnedCount} kelime var. Bunların ${a.suspect} tanesi ` +
		`bu etiketi hak etmiyor gibi görünüyor:\n\n` +
		`• ${a.weak} kelime yeterince üst üste doğru bilinmemiş\n` +
		`• ${a.noHistory} kelime hiç çalışılmamış (elle işaretlenmiş)\n` +
		`• ${a.earned} kelime etiketi gerçekten hak etmiş\n\n` +
		`Sebebi: 1.0'daki hesaplama hatası ve "Öğrenilmişe al" düğmesi.\n` +
		`Öğrenilmiş kelimeler tekrar kuyruğuna hiç girmez — yani bu kelimeler ` +
		`bir daha karşına çıkmaz.\n\nNe yapmak istersin?`;

	const choice = await choiceDialog(message, {
		title: 'İlerleme denetimi',
		options: [
			{
				value: 'verify',
				label: `Doğrulama turu (önerilen) — ${a.suspect} kelime`,
				description:
					'Geçmişe dokunulmaz. Her biri bir kez daha sorulur; bildiklerin öğrenilmiş kalır, bilemediklerin tekrar rotasyonuna döner.'
			},
			{
				value: 'replay',
				label: `Geçmişi baştan hesapla — ${a.suspect} kelime`,
				description:
					'Cevap geçmişin düzeltilmiş algoritmayla yeniden işlenir. En doğru sonucu verir, ama bazı kelimeler düşük seviyeye iner.'
			},
			{
				value: 'reset',
				label: `Sıfırla — ${a.suspect} kelime`,
				description: 'Şüpheli kelimeler 0. seviyeye döner, baştan çalışılır.',
				danger: true
			}
		]
	});

	if (!choice) return;

	if (choice === 'reset') {
		const ok = await confirmDialog(
			`${a.suspect} kelimenin ilerlemesi sıfırlanacak. Bu işlem geri alınamaz.\n\nÖnce "JSON Dışa Aktar" ile yedek almanı öneririm.`,
			{ title: 'Emin misin?', confirmText: 'Evet, sıfırla', danger: true }
		);
		if (!ok) return;
	}

	const result = await store.applyRepair(choice);
	toast(`${result.changed} kelimenin ilerlemesi güncellendi.`);
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
	$('upgradeBtn').addEventListener('click', openPaywall);

	$('startReviewBtn').addEventListener('click', handleStartReview);

	$('exportBtn').addEventListener('click', handleExport);
	$('importFile').addEventListener('change', (e) => {
		const file = e.target.files[0];
		if (file) handleImport(file);
		e.target.value = '';
	});

	$('navHome').addEventListener('click', () => showSection('home'));
	$('navTopics').addEventListener('click', () => showSection('topics'));
	$('navDialogues').addEventListener('click', () => showSection('dialogues'));
	$('navPool').addEventListener('click', () => showSection('pool'));
	$('navSettings').addEventListener('click', () => showSection('settings'));

	$('tabCards').addEventListener('click', () => switchView('cards'));
	$('tabTiles').addEventListener('click', () => switchView('tiles'));

	$('goalInput').addEventListener('change', (e) => store.setDailyGoal(e.target.value));

	$('reminderToggle').addEventListener('change', async (e) => {
		if (e.target.checked) {
			const granted = await notifications.requestPermission();
			if (!granted) {
				e.target.checked = false;
				await alertDialog(
					'Bildirim izni verilmedi.\n\nCihaz ayarlarından uygulamaya bildirim izni verirsen ' +
						'günlük hatırlatma kurulabilir.',
					{ title: 'İzin gerekli' }
				);
				return;
			}
		}
		await store.setReminder({ enabled: e.target.checked });
		await syncReminder();
	});

	$('reminderTime').addEventListener('change', async (e) => {
		const parsed = notifications.parseTime(e.target.value);
		if (!parsed) return;
		await store.setReminder(parsed);
		await syncReminder();
	});
	$('auditBtn').addEventListener('click', handleProgressAudit);

	$('resetTodayBtn').addEventListener('click', async () => {
		await store.resetTodayCounter();
		toast('Günlük sayaç sıfırlandı.');
	});

	$('wipeBtn').addEventListener('click', async () => {
		const ok = await confirmDialog(
			`Eklediğin kelimeler ve tüm ilerlemen silinecek. Bu işlem geri alınamaz.\n\n` +
				'Devam etmeden önce "JSON Dışa Aktar" ile yedek almanı öneririz.',
			{ title: 'Tüm veriyi sil', confirmText: 'Evet, hepsini sil', danger: true }
		);
		if (!ok) return;
		await store.wipeAll();
		toast('Tüm veri silindi. Sayfayı yenileyince temel paket yeniden kurulur.', 'warn');
	});
}

/** Ana bölümler arasında geçiş. */
function showSection(section) {
	activeSection = section;
	// Ucuncu sutun: hangi sekmenin yanacagi. Istatistigin kendi sekmesi
	// yok - ana ekrandan aciliyor ve acikken "Ana" sekmesi yanik kaliyor,
	// yoksa alt cubukta hicbir sey secili gorunmuyor ve kullanici nerede
	// oldugunu kaybediyor.
	const sections = [
		['home', 'homeView', 'navHome'],
		['topics', 'topicsView', 'navTopics'],
		['dialogues', 'dialoguesView', 'navDialogues'],
		['pool', 'poolView', 'navPool'],
		['settings', 'settingsView', 'navSettings'],
		['stats', 'statsView', 'navHome']
	];
	const activeTab = (sections.find(([name]) => name === section) || [])[2];

	for (const [name, viewId] of sections) {
		$(viewId).classList.toggle('hidden', section !== name);
	}
	for (const tab of document.querySelectorAll('.tabBtn')) {
		const on = tab.id === activeTab;
		tab.classList.toggle('active', on);
		tab.setAttribute('aria-selected', String(on));
	}
	window.scrollTo(0, 0);
	render();
}

function switchView(view) {
	activeView = view;
	$('listView').classList.toggle('hidden', view !== 'cards');
	$('tilesView').classList.toggle('hidden', view !== 'tiles');
	$('tabCards').classList.toggle('active', view === 'cards');
	$('tabTiles').classList.toggle('active', view === 'tiles');
	$('tabCards').setAttribute('aria-selected', String(view === 'cards'));
	$('tabTiles').setAttribute('aria-selected', String(view === 'tiles'));
	render();
}

/**
 * Hatırlatmayı güncel duruma göre kurar ya da iptal eder.
 * Her açılışta çalışır: bekleyen kelime sayısı değişmiş olabilir.
 */
async function syncReminder() {
	const r = store.state.profile.reminder || {};
	const info = $('reminderInfo');

	if (!r.enabled) {
		await notifications.cancelAll();
		if (info) info.textContent = '';
		return;
	}

	const stats = store.getStats(isDue);
	const ok = await notifications.scheduleDaily({
		hour: r.hour,
		minute: r.minute,
		due: stats.due,
		streak: store.state.profile.streak
	});

	if (info) {
		info.textContent = ok
			? `Her gün ${notifications.formatTime(r.hour, r.minute)} saatinde hatırlatılacak.`
			: 'Hatırlatma kurulamadı — bildirim izni gerekiyor.';
	}
}

/** Hatırlatma arayüzünü yalnızca desteklenen ortamda göster. */
async function setupReminderUi() {
	if (!(await notifications.isSupported())) return;
	$('reminderRow').classList.remove('hidden');

	const r = store.state.profile.reminder || {};
	$('reminderToggle').checked = !!r.enabled;
	$('reminderTime').value = notifications.formatTime(r.hour ?? 20, r.minute ?? 0);
	await syncReminder();
}

// ===================== Başlat =====================

/**
 * Giriş ekranını kaldırır.
 *
 * Asgari süre var: veri önbellekten 80 ms'de gelirse animasyon yarıda
 * kesilir ve ekran "takılmış gibi" titrer. Bekleme veri yüklemesini
 * geciktirmiyor — yalnızca katmanın kaybolmasını hizalıyor.
 */
const LAUNCH_MIN_MS = 900;
const launchStartedAt = Date.now();

async function hideLaunchScreen() {
	const node = $('launchScreen');
	if (!node) return;
	const remaining = LAUNCH_MIN_MS - (Date.now() - launchStartedAt);
	if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
	node.classList.add('launch--done');
	// Geçiş bitince DOM'dan tamamen çıkar: ekran okuyucular ve
	// sekme sırası için görünmez bir katman bile fazla.
	setTimeout(() => node.remove(), 600);
}

async function boot() {
	store.setStorageErrorHandler((message) => alertDialog(message, { title: 'Kayıt hatası' }));
	store.subscribe(render);

	wireEvents();
	activeView = 'cards';
	$('list').textContent = 'Yükleniyor…';
	showSection('home');

	const result = await store.init({ packUrl: PACK_URL });

	$('goalInput').value = store.state.settings.dailyGoal;
	showSection('home');
	setupReminderUi();

	if (result.migrated && result.migrationReport) {
		const r = result.migrationReport;
		toast(`${r.matched + r.userOwned} kelime yeni depoya taşındı.`);
	} else if (result.packInstalled) {
		toast('Temel kelime paketi kuruldu.');
	}

	// Android kabugu: durum cubugu, acilis ekrani ve geri tusu.
	// Tarayicida hicbir sey yapmaz.
	setupNative({ onBack: handleBackButton });

	// Veri hazir; giris ekrani artik gidebilir.
	hideLaunchScreen();

	// Diyaloglar acilisi bekletmesin: arka planda yuklenip geldiginde
	// ekran tazeleniyor. Yuklenemezse liste bos kalir, uygulama calisir.
	loadDialogues(DIALOGUES_URL).then((list) => {
		dialogues = list;
		if (activeSection === 'dialogues') render();
	});

	if (result.repair && result.repair.changed) {
		const a = result.repair.analysis;
		await alertDialog(
			`"Öğrenilmiş" işaretli ${a.learnedCount} kelimeden ${result.repair.changed} tanesi bu etiketi ` +
				`hak etmiyordu:

` +
				`• ${a.weak} kelime yeterince üst üste doğru bilinmemiş
` +
				`• ${a.noHistory} kelime hiç çalışılmamış (elle işaretlenmiş)
` +
				`• ${a.earned} kelime etiketi gerçekten hak etmiş, dokunulmadı

` +
				`Sebebi 1.0'daki hesaplama hatasıydı. Bu kelimeler artık tekrar kuyruğuna giriyor; ` +
				`doğru bildiklerin yeniden "öğrenilmiş" olacak.

` +
				`Cevap geçmişin olduğu gibi korundu.`,
			{ title: 'İlerleme onarıldı' }
		);
	}
}

boot();

/**
 * Android geri tusu: acik katmani kapat.
 * @returns {boolean} Olay yutuldu mu
 */
function handleBackButton() {
	// En ustteki katmandan basla
	const dialog = document.querySelector('.dialogOverlay');
	if (dialog) {
		const cancel = dialog.querySelector('.dialogActions button');
		if (cancel) cancel.click();
		return true;
	}
	if (document.querySelector('.placeOverlay')) {
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		return true;
	}
	if (review.isActive()) {
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		return true;
	}
	// Ana ekran disinda bir bolumdeyse ana ekrana don
	if (activeSection !== 'home') {
		showSection('home');
		return true;
	}
	return false;
}

// Geliştirme sırasında konsoldan incelemek için
if (import.meta.env.DEV) {
	Object.assign(window, { store, render, MAX_LEVEL, buildReviewQueue, isDue });
}
