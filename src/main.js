/**
 * Uygulama girişi: modülleri birbirine bağlar ve olayları dinler.
 *
 * Burada iş mantığı yoktur — sadece "kullanıcı şunu yaptı -> store'daki
 * şu fonksiyonu çağır -> ekranı tazele" eşlemesi.
 */
import './styles/main.css';

import { isLevelUnlocked, lockedLevels } from './core/entitlements.js';
import { levelsUpTo } from './core/placement.js';
import { buildDailyPlan, DAILY_MINUTES, GOALS } from './core/plan.js';
import { isDialogueUnlocked } from './core/dialogues.js';
import { topicSummaries } from './core/topics.js';
import { isStruggling } from './core/stats.js';
import { setRate, speak } from './core/speech.js';
import { renderTopicChip, renderTopics } from './ui/topics.js';
import { findDialogue, loadDialogues } from './core/dialogues.js';
import { renderDialogue, renderDialogueList } from './ui/dialogues.js';
import { isSupported as micSupported } from './platform/speech-input.js';
import { startPractice, stopPractice } from './ui/dialoguePractice.js';
import { buildReviewQueue, countQueue, MAX_LEVEL } from './core/srs.js';
import { isDue } from './core/time.js';
import * as store from './data/store.js';
import * as notifications from './platform/notifications.js';
import { setupNative } from './platform/native.js';
import { renderDashboard } from './ui/dashboard.js';
import { alertDialog, choiceDialog, confirmDialog, formDialog, toast } from './ui/dialog.js';
import { hasAccount, initials, isValidEmail, localId, NO_ACCOUNT, normalizeAccount } from './core/account.js';
import { mergeProfile, mergeProgressLists } from './core/sync.js';
import {
	currentUser,
	deleteAccount as cloudDeleteAccount,
	fetchAll as cloudFetchAll,
	isAvailable as isCloudAvailable,
	pushChanges as cloudPush,
	signIn as cloudSignIn,
	signOut as cloudSignOut,
	signUp as cloudSignUp
} from './platform/cloud.js';
import { renderCloudPanel } from './ui/cloudPanel.js';
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
/** Rol yapma acikken diyalog kimligi; null = okuma gorunumu. */
let practiceDialogueId = null;
/** Cihazda konusma tanima var mi? Acilista bir kez olculuyor. */
let speechInput = false;

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
		renderProfileCard();
		renderCloudPanel(cloud, cloudHandlers);
		renderStats(store.getStats(isDue), 0, store.state.settings.dailyGoal);
		return;
	}

	if (activeSection === 'stats') {
		// İstatistik profil seviyesi kapsamında; seviye yoksa tüm havuz.
		const scope = store.state.profile.level
			? filterWords(store.state.words, {}).filter((w) => levelsUpTo(store.state.profile.level).includes(w.cefr))
			: store.state.words;
		renderStatsView(scope, store.state.profile, {
			onStudyHard: () => startReviewSession({ hard: true })
		});
		// Istatistigin kendi sekmesi yok; geri donus yolu gorunur olmali.
		const host = $('statsView');
		const back = el('button', { class: 'ghost backBtn', text: '← Ana sayfa' });
		back.onclick = () => showSection('home');
		host.insertBefore(back, host.firstChild);
		renderStats(store.getStats(isDue), 0, store.state.settings.dailyGoal);
		return;
	}

	if (activeSection === 'dialogues') {
		// Rol yapma kendi cizimini yonetiyor; render onu ezmemeli.
		if (practiceDialogueId) return;
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
		// Hedef sorulmadiysa plan gosterilmez; once soru sorulur.
		overview.plan = store.state.profile.goalAskedAt ? currentPlan() : null;
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


// ===================== Gunluk plan =====================

/** Ana ekran icin bugunun plani. */
function currentPlan() {
	const prof = store.state.profile;
	const acik = dialogues.filter((d) => isDialogueUnlocked(d, prof.premium));
	const { topics } = topicSummaries(store.state.words, prof.premium);
	return buildDailyPlan({
		goal: prof.goal,
		dailyMinutes: prof.dailyMinutes,
		dueCount: store.getStats(isDue).due,
		hardCount: store.getStats(isDue).hard,
		dialogues: acik,
		topics,
		doneIds: store.todayDoneIds()
	});
}

/**
 * Hedef ve gunluk sure sorusu.
 * Uygulamanin plani buna dayaniyor; sorulmadan plan uretilemez.
 */
async function askGoal() {
	const prof = store.state.profile;

	const hedef = await choiceDialog('Neden Ingilizce ogreniyorsun?', {
		title: 'Hedefin',
		options: Object.entries(GOALS).map(([key, g]) => ({
			value: key,
			label: g.icon + '  ' + g.label
		})),
		cancelText: 'Vazgec'
	});
	if (!hedef) return;

	const sure = await choiceDialog('Her gun ne kadar zaman ayirabilirsin?', {
		title: 'Gunluk sure',
		options: DAILY_MINUTES.map((m) => ({ value: String(m), label: m + ' dakika' })),
		cancelText: 'Vazgec'
	});
	if (!sure) return;

	await store.savePlanPrefs({ goal: hedef, dailyMinutes: Number(sure) });
	toast('Planin hazir.');
	render();
}

/** Gorev satirina dokunulunca ilgili ekrana goturur. */
async function runTask(task) {
	await store.markTaskDone(task.id);
	if (task.kind === 'words') {
		const level = store.state.profile.level;
		activeLevel = 'all';
		startReviewSession({ levels: level ? levelsUpTo(level) : null });
		return;
	}
	if (task.kind === 'dialogue') {
		openDialogueId = task.target;
		showSection('dialogues');
		return;
	}
	if (task.kind === 'topic') {
		activeTopic = task.target;
		startReviewSession({ topic: task.target });
		return;
	}
	if (task.kind === 'hard') {
		startReviewSession({ hard: true });
	}
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
	onStats: () => showSection('stats'),
	onTask: (task) => runTask(task),
	onEditGoal: () => askGoal(),
	onSetupPlan: () => askGoal()
};

/**
 * Ayarlar ekranindaki profil karti.
 *
 * Bu bir HESAP DEGIL: sunucu yok, bilgiler cihazda duruyor. Kart bunu
 * acikca yaziyor - kullanicinin verisinin bulutta durdugunu sanmasi,
 * telefonunu kaybettiginde ilerlemesini kaybetmesi demek.
 */
function renderProfileCard() {
	const host = $('profileCard');
	if (!host) return;
	host.textContent = '';

	const account = store.state.profile.account || NO_ACCOUNT;
	const kurulu = hasAccount(account);

	const avatar = el('div', { class: 'avatar', text: kurulu ? initials(account) : '?' });

	const duzenle = el('button', {
		class: 'iconBtn profileEdit',
		text: kurulu ? '✏️' : '＋'
	});
	duzenle.setAttribute('aria-label', kurulu ? 'Profili düzenle' : 'Profil oluştur');
	duzenle.onclick = () => editProfile();

	const bilgi = el('div', { class: 'profileInfo' }, [
		el('div', { class: 'profileName', text: kurulu ? account.name : 'Profil oluştur' }),
		el('div', {
			class: 'profileSub',
			text: kurulu ? account.email : 'Adını ve e-postanı ekle'
		}),
		kurulu ? el('span', { class: 'profileId', text: 'ID ' + localId(account) }) : null
	]);

	const kart = el('div', { class: 'profileCard' }, [avatar, bilgi, duzenle]);
	kart.onclick = (e) => {
		if (e.target === duzenle) return;
		editProfile();
	};
	host.appendChild(kart);

	host.appendChild(el('div', {
		class: 'small profileNote',
		text: 'Bu profil yalnızca bu cihazda saklanır. Uygulamanın sunucusu yok, ' +
			'bu yüzden başka bir cihazdan giriş yapılamaz.'
	}));
}

/** Profil oluşturma / düzenleme akışı. */
async function editProfile() {
	const mevcut = store.state.profile.account || NO_ACCOUNT;
	const values = await formDialog({
		title: hasAccount(mevcut) ? 'Profili düzenle' : 'Profil oluştur',
		message: 'Bu bilgiler yalnızca cihazında saklanır.',
		fields: [
			{ name: 'name', label: 'Ad', value: mevcut.name, placeholder: 'Adın', maxLength: 40 },
			{ name: 'email', label: 'E-posta', type: 'email', value: mevcut.email,
				placeholder: 'ornek@eposta.com' }
		],
		submitText: 'Kaydet',
		validate: (v) => {
			const r = normalizeAccount(v);
			if (r.ok) return null;
			if (r.reason === 'name') return 'Ad boş olamaz.';
			if (r.reason === 'name-long') return 'Ad en fazla 40 karakter olabilir.';
			return 'E-posta adresi geçerli görünmüyor.';
		}
	});
	if (!values) return;

	const r = normalizeAccount(values);
	if (!r.ok) return;
	await store.saveAccount(r.account);
	toast('Profil kaydedildi.');
	render();
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
	onPractice: (id) => {
		const d = findDialogue(dialogues, id);
		if (!d) return;
		practiceDialogueId = id;
		window.scrollTo(0, 0);
		startPractice(d, dialogues, {
			onExit: () => {
				stopPractice();
				practiceDialogueId = null;
				window.scrollTo(0, 0);
				render();
			}
		}, { allowSpeak: speechInput });
	},
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

// ===================== Tekrar =====================

function handleStartReview() {
	return startReviewSession({ free: $('freeReview').checked });
}

/**
 * Tekrar oturumunu başlatır.
 * @param {{free?: boolean, levels?: string[]|null}} options
 *   levels verilirse yalnızca o CEFR seviyeleri; yoksa havuzdaki seçim.
 */
async function startReviewSession({ free = false, levels = null, topic = null, hard = false } = {}) {
	// Zorlanilanlar ve konu secimi seviye kapsamini gecersiz kilar:
	// kullanici "zorlandiklarim" dedigi anda istedigi sey onlar.
	let pool = hard
		? store.state.words.filter(isStruggling)
		: topic
			? store.state.words.filter((w) => w.topic === topic)
			: levels
				? store.state.words.filter((w) => levels.includes(w.cefr))
				: wordsAtLevel();

	// Zorlanilan kelimelerde SERBEST tekrar sart: bunlarin cogunun
	// tekrar zamani gelmemis olabilir ama zorlanildigi icin
	// calisilmak isteniyor.
	if (hard) free = true;

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
		const scopeLabel = hard
			? ' (zorlandiklarin arasinda)'
			: topic
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


// ===================== Bulut hesabi =====================

/** Bulut durumu. available=false ise bolum hic gorunmez. */
let cloud = { available: false, user: null, syncing: false, lastSync: null };

async function initCloud() {
	cloud.available = await isCloudAvailable();
	if (!cloud.available) return;
	cloud.user = await currentUser();
	if (activeSection === 'settings') render();
	// Girisliyse acilista sessizce esitle: kullanicinin dugmeye
	// basmayi hatirlamasi gerekmemeli.
	if (cloud.user) syncNow({ sessiz: true });
}

const cloudHandlers = {
	onSignIn: () => authFlow('in'),
	onSignUp: () => authFlow('up'),
	onSync: () => syncNow({ sessiz: false }),
	onSignOut: async () => {
		const ok = await confirmDialog(
			'Cikis yapilacak. Cihazdaki ilerlemen silinmez, buluta gonderilmeyen degisiklikler bekler.',
			{ title: 'Cikis', confirmText: 'Cikis yap' }
		);
		if (!ok) return;
		await cloudSignOut();
		cloud.user = null;
		toast('Cikis yapildi.');
		render();
	},
	onDelete: () => deleteCloudAccount()
};

/** Giris / kayit akisi. */
async function authFlow(mode) {
	const kayit = mode === 'up';
	const alanlar = [
		{ name: 'email', label: 'E-posta', type: 'email', placeholder: 'ornek@eposta.com' },
		{ name: 'password', label: 'Parola', type: 'password', placeholder: 'En az 6 karakter' }
	];
	if (kayit) alanlar.unshift({ name: 'name', label: 'Ad', placeholder: 'Adin', maxLength: 40 });

	const v = await formDialog({
		title: kayit ? 'Hesap ac' : 'Giris yap',
		message: kayit
			? 'Ilerlemen buluta yedeklenir ve baska cihazdan devam edebilirsin.'
			: 'Hesabinla giris yap.',
		fields: alanlar,
		submitText: kayit ? 'Hesap ac' : 'Giris yap',
		validate: (val) => {
			if (kayit && !String(val.name || '').trim()) return 'Ad bos olamaz.';
			if (!isValidEmail(val.email)) return 'E-posta adresi gecerli gorunmuyor.';
			if (String(val.password || '').length < 6) return 'Parola en az 6 karakter olmali.';
			return null;
		}
	});
	if (!v) return;

	const sonuc = kayit
		? await cloudSignUp(v.email, v.password, v.name)
		: await cloudSignIn(v.email, v.password);

	if (!sonuc.ok) {
		await alertDialog(authHatasi(sonuc.reason), { title: 'Olmadi' });
		return;
	}
	cloud.user = sonuc.user;
	// Kayit sirasinda girilen ad yerel profile de yazilir; kullanici
	// ayni bilgiyi iki kez girmesin.
	if (kayit && v.name) await store.saveAccount({ name: v.name, email: v.email });
	toast(kayit ? 'Hesap acildi.' : 'Giris yapildi.');
	render();
	syncNow({ sessiz: false });
}

function authHatasi(reason) {
	if (reason === 'email-in-use') return 'Bu e-posta ile zaten bir hesap var. Giris yapmayi dene.';
	if (reason === 'invalid-email') return 'E-posta adresi gecerli gorunmuyor.';
	if (reason === 'weak-password') return 'Parola cok zayif. En az 6 karakter secmelisin.';
	if (reason === 'bad-credentials') return 'E-posta ya da parola hatali.';
	if (reason === 'too-many') return 'Cok fazla deneme yapildi. Biraz bekleyip tekrar dene.';
	if (reason === 'network') return 'Internet baglantisi kurulamadi.';
	return 'Islem tamamlanamadi.';
}


/**
 * Buluta yaz, buluttan oku, birlestir.
 *
 * Once OKUYOR sonra yaziyor. Ters sirada, baska cihazda yapilan
 * calisma bu cihazin eski verisiyle ezilirdi.
 */
async function syncNow({ sessiz }) {
	if (!cloud.user || cloud.syncing) return;
	cloud.syncing = true;
	if (activeSection === 'settings') render();

	try {
		const uzak = await cloudFetchAll();
		if (!uzak.ok) {
			if (!sessiz) await alertDialog(authHatasi(uzak.reason), { title: 'Esitlenemedi' });
			return;
		}

		const yerel = store.progressForSync();
		const sonuc = mergeProgressLists(yerel, uzak.progress || []);
		const profil = mergeProfile(store.profileForSync(), uzak.profile);

		if (sonuc.toApply.length) await store.applySyncedProgress(sonuc.toApply);
		await store.applySyncedProfile(profil);

		const yaz = await cloudPush(profil, sonuc.toUpload);
		if (!yaz.ok) {
			if (!sessiz) await alertDialog(authHatasi(yaz.reason), { title: 'Gonderilemedi' });
			return;
		}

		cloud.lastSync = new Date().toISOString();
		if (!sessiz) {
			const s2 = sonuc.stats;
			toast(`Esitlendi: ${s2.gonderilecek} gonderildi, ${s2.uygulanacak} alindi.`);
		}
	} finally {
		cloud.syncing = false;
		render();
	}
}

/**
 * Hesabi ve bulut verisini siler.
 * Play, hesap acan uygulamalarda uygulama ici hesap silmeyi zorunlu
 * tutuyor.
 */
async function deleteCloudAccount() {
	const ok = await confirmDialog(
		'Hesabın ve buluttaki tüm verin kalıcı olarak silinecek.'
			+ String.fromCharCode(10, 10)
			+ 'Cihazındaki ilerlemen SİLİNMEZ; sadece bulut kaydın gider.',
		{ title: 'Hesabi sil', confirmText: 'Sil', danger: true }
	);
	if (!ok) return;

	const sonuc = await cloudDeleteAccount();
	if (!sonuc.ok) {
		await alertDialog(
			sonuc.reason === 'reauth'
				? 'Guvenlik icin once cikis yapip tekrar giris yapmalisin, sonra silebilirsin.'
				: authHatasi(sonuc.reason),
			{ title: 'Silinemedi' }
		);
		return;
	}
	cloud.user = null;
	cloud.lastSync = null;
	toast('Hesap silindi.');
	render();
}

// ===================== Olay bağlantıları =====================

function wireEvents() {
	$('search').addEventListener('input', debounce(render, 150));
	$('filterDue').addEventListener('change', render);

	const setFilter = (value) => () => {
		$('filterDue').value = value;
		render();
	};
	$('poolAllBtn').addEventListener('click', setFilter('all'));
	$('poolDueBtn').addEventListener('click', setFilter('due'));
	$('poolLearnedBtn').addEventListener('click', setFilter('learned'));
	$('poolHardBtn').addEventListener('click', setFilter('hard'));
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
	$('rateSelect').addEventListener('change', async (e) => {
		const r = Number(e.target.value);
		setRate(r);
		await store.setSpeechRate(r);
		// Degisikligi duyurmak icin ornek bir kelime okunuyor;
		// kullanici secimini kulagiyla dogrulasin.
		speak('This is the new speed.');
	});

	$('auditBtn').addEventListener('click', handleProgressAudit);

	$('wipeBtn').addEventListener('click', async () => {
		const ok = await confirmDialog(
			`Tüm ilerlemen silinecek. Bu işlem geri alınamaz.\n\n` +
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
	// Sekmeye basmak rol yapmadan cikar.
	//
	// Cikmazsa render() "rol yapma kendi cizimini yonetiyor" diye erken
	// donuyor ve gidilen ekran BOS kaliyordu - kullanici uygulamayi
	// kirilmis saniyor.
	if (practiceDialogueId) {
		stopPractice();
		practiceDialogueId = null;
	}
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
	// Kayitli hiz konusma motoruna ve secicilere uygulaniyor.
	setRate(store.state.settings.speechRate);
	$('rateSelect').value = String(store.state.settings.speechRate);
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

	// Konusma tanima var mi? Yoksa rol yapmada konusma adimi hic
	// verilmiyor - calismayan bir mikrofon dugmesi gostermek olurdu.
	micSupported().then((v) => { speechInput = v; });

	// Bulut da acilisi bekletmesin; yapilandirma yoksa hicbir sey yapmaz.
	initCloud();

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
