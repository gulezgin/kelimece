/**
 * Günlük öğrenme planı.
 *
 * Uygulamayı açan kişi "bugün ne yapayım?" diye düşünmemeli; uygulama
 * "bugün senin için bunu hazırladım" demeli. Plan iki girdiden
 * üretiliyor: kullanıcının HEDEFİ (neden öğreniyor) ve günlük
 * AYIRABİLDİĞİ SÜRE.
 *
 * Hedef, içeriğin hangi konudan seçileceğini belirliyor; süre ise kaç
 * görev verileceğini. Beş dakikası olan birine dört görev vermek,
 * planı motive edici olmaktan çıkarıp suçluluk üretecine çevirir.
 *
 * Saf mantık: DOM'a, depoya ve ağa dokunmaz.
 */

/** Öğrenme hedefleri ve hangi konulara yöneldikleri. */
export const GOALS = {
	daily: {
		label: 'Günlük konuşma',
		icon: '💬',
		topics: ['günlük', 'sohbet', 'yiyecek', 'alışveriş', 'insanlar'],
		dialogueTopics: ['tanışma', 'sohbet', 'yiyecek', 'günlük', 'alışveriş']
	},
	travel: {
		label: 'Seyahat',
		icon: '✈️',
		topics: ['seyahat', 'ulaşım', 'yerler', 'yiyecek', 'para ve alışveriş'],
		dialogueTopics: ['seyahat', 'yiyecek', 'alışveriş']
	},
	work: {
		label: 'İş hayatı',
		icon: '💼',
		topics: ['okul ve iş', 'meslekler', 'para ve alışveriş', 'iletişim'],
		dialogueTopics: ['iş', 'iletişim', 'resmi']
	},
	interview: {
		label: 'Mülakat',
		icon: '🎯',
		topics: ['okul ve iş', 'meslekler', 'duygular'],
		dialogueTopics: ['iş']
	},
	school: {
		label: 'Okul / akademik',
		icon: '🎓',
		topics: ['okul ve iş', 'bilim', 'akademik'],
		dialogueTopics: ['akademik', 'okul']
	},
	general: {
		label: 'Genel İngilizce',
		icon: '🌍',
		topics: [],
		dialogueTopics: []
	}
};

/**
 * Zorlanılan kelime görevinin alt sınırı.
 * Bunun altında ayrı bir görev satırı planı şişirir ve bir oturumu
 * doldurmaz.
 */
export const HARD_TASK_MIN = 5;

/** Günlük süre seçenekleri (dakika). */
export const DAILY_MINUTES = [5, 10, 15, 30, 60];

/** Varsayılan: hedef sorulmadıysa genel, süre sorulmadıysa 10 dakika. */
export const DEFAULT_PLAN_PREFS = { goal: 'general', dailyMinutes: 10 };

/** Hedef tanımı; bilinmeyen anahtarda genele düşer. */
export function goalInfo(goal) {
	return GOALS[goal] || GOALS.general;
}

/**
 * Süreye göre kaç görev verileceği.
 *
 * Sayılar deneyimsel: bir çalışma oturumu ~5 dakika, bir diyalog
 * ~4 dakika, bir konu turu ~5 dakika sürüyor. Toplamı süreyi biraz
 * aşabilir — plan bir üst sınır değil, bir öneri.
 */
function taskBudget(minutes) {
	const m = Number(minutes) || 10;
	if (m <= 5) return { words: 1, dialogue: 0, topic: 0 };
	if (m <= 10) return { words: 1, dialogue: 1, topic: 0 };
	if (m <= 15) return { words: 1, dialogue: 1, topic: 1 };
	if (m <= 30) return { words: 2, dialogue: 1, topic: 1 };
	return { words: 2, dialogue: 2, topic: 2 };
}

/**
 * Hedefe uyan içeriği öne alır ama uymayanı ELEMEZ.
 *
 * Elemek, hedefi "seyahat" olan birinin havuzun beşte dördünü hiç
 * görmemesi demek olurdu. Amaç öncelik vermek, kapı kapatmak değil.
 */
function preferByTopic(items, tercihEdilen) {
	if (!tercihEdilen || !tercihEdilen.length) return items.slice();
	const uyan = [];
	const digerleri = [];
	for (const it of items) {
		(tercihEdilen.includes(it.topic) ? uyan : digerleri).push(it);
	}
	return [...uyan, ...digerleri];
}

/**
 * Bugünün görev listesini üretir.
 *
 * @param {object} options
 * @param {string} options.goal
 * @param {number} options.dailyMinutes
 * @param {number} options.dueCount Tekrar bekleyen kelime sayısı
 * @param {number} [options.hardCount] Zorlanılan kelime sayısı
 * @param {object[]} options.dialogues Açık (kilitsiz) diyaloglar
 * @param {object[]} options.topics Konu özetleri
 * @param {string[]} [options.doneIds] Bugün tamamlanan görev kimlikleri
 * @returns {{tasks: object[], done: number, total: number}}
 */
export function buildDailyPlan({
	goal = 'general',
	dailyMinutes = 10,
	dueCount = 0,
	hardCount = 0,
	dialogues = [],
	topics = [],
	doneIds = []
} = {}) {
	const bilgi = goalInfo(goal);
	const butce = taskBudget(dailyMinutes);
	const tamamlanan = new Set(doneIds);
	const tasks = [];

	for (let i = 0; i < butce.words; i++) {
		tasks.push({
			id: 'words-' + i,
			kind: 'words',
			icon: '📚',
			title: i === 0 ? 'Kelime çalış' : 'Bir tur daha kelime',
			note: dueCount > 0 ? `${dueCount} kelime tekrar bekliyor` : 'Yeni kelimelerle',
			minutes: 5
		});
	}

	/*
	 * Zorlanilan kelimeler yeterince birikince ayri gorev oluyor.
	 *
	 * Esik neden var: iki kelime icin ayri bir gorev satiri gostermek
	 * plani sisirir ve o gorev bir oturumu doldurmaz. Bes kelime,
	 * kisa ama anlamli bir tur icin alt sinir.
	 *
	 * Kelime gorevinden SONRA geliyor: once gunun normal akisi, sonra
	 * telafi. Basa koymak, gunun ilk isini "basarisizliklarinla
	 * yuzles" yapardi.
	 */
	if (hardCount >= HARD_TASK_MIN && butce.words > 0) {
		tasks.push({
			id: 'hard',
			kind: 'hard',
			icon: '🔥',
			title: 'Zorlandıkların',
			note: `${hardCount} kelimede takılıyorsun`,
			minutes: 4
		});
	}

	// Hedefe uyan diyaloglar once, ama digerleri de listede kalir.
	const sirali = preferByTopic(dialogues, bilgi.dialogueTopics);
	for (let i = 0; i < butce.dialogue && i < sirali.length; i++) {
		const d = sirali[i];
		tasks.push({
			id: 'dialogue-' + d.id,
			kind: 'dialogue',
			icon: '🎭',
			title: d.title,
			note: 'Diyalogu konuş',
			minutes: 4,
			target: d.id
		});
	}

	const konuSirali = preferByTopic(topics, bilgi.topics);
	for (let i = 0; i < butce.topic && i < konuSirali.length; i++) {
		const t = konuSirali[i];
		tasks.push({
			id: 'topic-' + t.topic,
			kind: 'topic',
			icon: t.icon || '🗂️',
			title: t.topic,
			note: 'Konuyu çalış',
			minutes: 5,
			target: t.topic
		});
	}

	for (const t of tasks) t.done = tamamlanan.has(t.id);

	return {
		tasks,
		done: tasks.filter((t) => t.done).length,
		total: tasks.length,
		minutes: tasks.reduce((s, t) => s + t.minutes, 0)
	};
}
