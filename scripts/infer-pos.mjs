/**
 * Sözcük türünü (pos) ve konuyu (topic) çıkarsar.
 *
 * 2493 kelimenin 1652'sinde bu iki alan boştu — sonradan elle eklenen
 * 841 kelimede vardı. Elle 1652 kayıt doldurmak yerine güvenilir
 * ipuçlarından çıkarım yapılıyor.
 *
 * EN GÜÇLÜ İPUCU: Türkçe karşılık. Türkçede mastar "-mek/-mak" ile
 * biter; "terk etmek" karşılığı olan bir İngilizce kelime fiildir.
 * Bu tek kural fiillerin neredeyse tamamını yakalıyor.
 *
 * İngilizce son ekleri ikinci ipucu (-ly → zarf, -tion → isim,
 * -ous → sıfat...). Çakışmada Türkçe kazanır: "-mek" biten çeviri
 * kesin fiildir, İngilizce son eki ne olursa olsun.
 *
 * Emin olunamayan kayıtlar BOŞ bırakılır — yanlış etiket, etiketsizden
 * daha zararlı.
 *
 * Çıktı: data/pos-map.json  (paket üreticisi okur)
 * Çalıştırma: node scripts/infer-pos.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACK = join(ROOT, 'public/content/core-v1.json');
const OUT = join(ROOT, 'data/pos-map.json');
const DRY = process.argv.includes('--dry');

const pack = JSON.parse(readFileSync(PACK, 'utf8'));

/**
 * ELLE yazilmis sozcuk turu ve konu degerleri.
 *
 * Dikkat: uretilmis paketten (core-v1.json) okumak geri besleme
 * dongusu yaratiyor. Paket bu betigin bir onceki ciktisini icerdigi
 * icin, hatali bir cikarim "zaten vardi" sayilip sonsuza kadar
 * korunuyordu - duzeltme hic uygulanmiyordu.
 *
 * Bu yuzden elle yazilan degerler yalnizca KAYNAK dosyalardan okunuyor.
 */
const manualPos = new Map();
const manualTopic = new Map();
for (const file of ['data/additions-a1-core.json', 'data/additions-core-b.json']) {
	try {
		const data = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
		for (const w of data.words || []) {
			if (w.pos) manualPos.set(w.en, w.pos);
			if (w.topic) manualTopic.set(w.en, w.topic);
		}
	} catch {
		// dosya yoksa gec
	}
}

// ===================== Sözcük türü =====================

/** Türkçe mastar ekleri. Ünlü uyumu iki biçim veriyor. */
const TR_VERB_ENDINGS = ['mek', 'mak'];

/**
 * "-mak/-mek" ile biten ama fiil OLMAYAN Türkçe isimler.
 *
 * Kural güçlü ama kusursuz değil: "parmak", "ekmek", "yemek" mastar
 * gibi bitiyor. Bu liste olmadan "bread" (ekmek) fiil işaretleniyordu.
 */
const TR_NOUN_EXCEPTIONS = new Set([
	'parmak', 'ekmek', 'yemek', 'kaymak', 'çakmak', 'ilmek', 'tokmak',
	'bıçak', 'kaynak', 'durak', 'yatak', 'kapak', 'sıcak', 'tarak',
	'oyuncak', 'bardak', 'ayak', 'damak', 'yanak', 'dudak', 'çocuk',
	'başak', 'sokak', 'yaprak', 'toprak', 'kucak', 'bacak', 'dirsek',
	'köpek', 'elek', 'çiçek', 'böcek', 'gömlek', 'etek', 'erkek',
	'inek', 'kelebek', 'bebek', 'direk', 'yürek', 'kürek', 'melek'
]);

/** İngilizce son ek -> tür. Uzun ekler önce denenmeli. */
const EN_SUFFIX_POS = [
	['ously', 'adverb'], ['ically', 'adverb'], ['fully', 'adverb'], ['ly', 'adverb'],
	['ness', 'noun'], ['ment', 'noun'], ['tion', 'noun'], ['sion', 'noun'],
	['ance', 'noun'], ['ence', 'noun'], ['ship', 'noun'], ['hood', 'noun'],
	['ity', 'noun'], ['ism', 'noun'], ['ist', 'noun'], ['ure', 'noun'],
	['ous', 'adjective'], ['ful', 'adjective'], ['less', 'adjective'],
	['ive', 'adjective'], ['able', 'adjective'], ['ible', 'adjective'],
	['ical', 'adjective'], ['ish', 'adjective'], ['ent', 'adjective'],
	['ify', 'verb'], ['ise', 'verb'], ['ize', 'verb'], ['ate', 'verb']
];

/**
 * Türkçe karşılık fiil mastarı mı?
 * "terk etmek, vazgeçmek" -> evet. Virgüllü listede herhangi biri yeterli.
 */
function trLooksLikeVerb(tr) {
	return String(tr || '')
		.toLowerCase()
		.split(/[,;]/)
		.map((p) => p.trim())
		.filter(Boolean)
		.some((part) => {
			// Tek sözcüklü karşılık isim istisnalarında olabilir.
			// Çok sözcüklüde ("terk etmek") böyle bir risk yok.
			if (!/\s/.test(part) && TR_NOUN_EXCEPTIONS.has(part)) return false;
			return TR_VERB_ENDINGS.some((e) => part.endsWith(e));
		});
}

function inferPos(word) {
	const en = word.en.toLowerCase().trim();

	// Çok kelimeli: öbek fiil mi, kalıp mı?
	if (/\s/.test(en)) {
		if (trLooksLikeVerb(word.tr)) return { pos: 'phrasal verb', why: 'tr-mastar' };
		return { pos: 'phrase', why: 'cok-kelimeli' };
	}

	// Türkçe mastar en güvenilir ipucu
	if (trLooksLikeVerb(word.tr)) return { pos: 'verb', why: 'tr-mastar' };

	for (const [suffix, pos] of EN_SUFFIX_POS) {
		if (en.endsWith(suffix) && en.length > suffix.length + 2) {
			return { pos, why: 'en-sonek:' + suffix };
		}
	}

	return null;
}

// ===================== Konu =====================

/**
 * Konu grupları. Yalnızca anlamı net biçimde bir alana giren kelimeler
 * etiketleniyor; "abandon" gibi genel kelimeler konusuz kalıyor - ve
 * bu doğru: her kelimenin konusu olmak zorunda değil.
 */
const TOPIC_GROUPS = {
	'vücut': ['arm', 'ankle', 'back', 'blood', 'bone', 'brain', 'cheek', 'chest', 'chin',
		'ear', 'elbow', 'eye', 'eyebrow', 'face', 'finger', 'foot', 'hair', 'hand', 'head',
		'heart', 'knee', 'leg', 'lip', 'mouth', 'muscle', 'nail', 'neck', 'nose', 'shoulder',
		'skin', 'stomach', 'teeth', 'throat', 'toe', 'tongue', 'tooth', 'wrist', 'belly',
		'beard', 'pulse', 'flesh', 'breath', 'palm'],

	'sağlık': ['ache', 'ambulance', 'cancer', 'clinic', 'cure', 'deaf', 'diet', 'disease',
		'doctor', 'earache', 'exercise', 'fever', 'headache', 'heal', 'health', 'healthy',
		'hospital', 'hurt', 'illness', 'injured', 'medical', 'medication', 'medicine', 'nurse',
		'pain', 'painful', 'patient', 'pill', 'poison', 'pregnant', 'sick', 'sore',
		'stomachache', 'surgery', 'surgeon', 'therapy', 'virus', 'wound', 'first aid'],

	'yiyecek ve içecek': ['apple', 'banana', 'bean', 'bread', 'breakfast', 'butter', 'cake',
		'candy', 'carrot', 'cheese', 'chicken', 'chocolate', 'coffee', 'cookie', 'corn',
		'cream', 'dinner', 'drink', 'eat', 'egg', 'flour', 'food', 'fruit', 'juice', 'lunch',
		'meal', 'meat', 'milk', 'onion', 'pepper', 'pie', 'pizza', 'pork', 'potato', 'rice',
		'salad', 'salt', 'sandwich', 'sauce', 'soup', 'steak', 'sugar', 'supper', 'tea',
		'tomato', 'vegetable', 'water', 'wine', 'beer', 'alcohol', 'whiskey', 'champagne',
		'soda', 'taste', 'delicious', 'hungry', 'thirsty', 'cook', 'bake', 'poultry'],

	'aile': ['aunt', 'baby', 'brother', 'child', 'children', 'cousin', 'dad', 'daughter',
		'family', 'father', 'grandfather', 'grandma', 'grandmother', 'husband', 'married',
		'marriage', 'marry', 'mom', 'mother', 'nephew', 'niece', 'parent', 'sister', 'son',
		'uncle', 'wife', 'divorce', 'wedding', 'twin'],

	'ev': ['apartment', 'bath', 'bathroom', 'bed', 'bedroom', 'bowl', 'closet', 'couch',
		'cup', 'curtain', 'desk', 'door', 'floor', 'furniture', 'garage', 'garden', 'home',
		'house', 'kitchen', 'lamp', 'living room', 'mirror', 'oven', 'pan', 'plate', 'refrigerator',
		'roof', 'room', 'rug', 'sofa', 'stair', 'table', 'toilet', 'wall', 'window', 'basement',
		'laundry', 'garbage', 'trash', 'key', 'lock'],

	'giysi': ['belt', 'boot', 'bracelet', 'clothes', 'coat', 'costume', 'dress', 'earrings',
		'gloves', 'hat', 'jacket', 'jeans', 'makeup', 'necklace', 'pants', 'pocket', 'purse',
		'scarf', 'shirt', 'shoe', 'shorts', 'skirt', 'socks', 'suit', 'sweater', 'T-shirt',
		'tattoo', 'trousers', 'underwear', 'uniform', 'wallet', 'wear'],

	'hayvanlar': ['animal', 'bat', 'bear', 'bee', 'bird', 'cat', 'cattle', 'cow', 'creature',
		'dog', 'duck', 'elephant', 'fish', 'giraffe', 'goat', 'horse', 'insect', 'lion',
		'monkey', 'mouse', 'pig', 'rabbit', 'rat', 'shark', 'sheep', 'snake', 'tiger', 'wolf',
		'crow', 'tail', 'wing', 'bark', 'hunt'],

	'doğa ve hava': ['air', 'beach', 'cave', 'cliff', 'cloud', 'coast', 'desert', 'earth',
		'earthquake', 'flower', 'fog', 'forest', 'grass', 'hill', 'humid', 'ice', 'icy',
		'island', 'lake', 'lightning', 'moon', 'mountain', 'ocean', 'rain', 'river', 'sand',
		'sea', 'shore', 'sky', 'snow', 'snowy', 'star', 'storm', 'sun', 'sunflower', 'thunder',
		'tornado', 'tree', 'valley', 'weather', 'wind', 'winter', 'summer', 'spring', 'autumn',
		'seed', 'plant', 'shell'],

	'ulaşım': ['aircraft', 'airplane', 'airport', 'bicycle', 'bike', 'boat', 'bus',
		'bus station', 'bus stop', 'car', 'driver', 'drive', 'engine', 'ferry', 'flight',
		'helicopter', 'highway', 'journey', 'license', 'luggage', 'passport', 'plane', 'road',
		'ship', 'station', 'street', 'subway', 'taxi', 'ticket', 'traffic', 'train', 'travel',
		'trip', 'truck', 'tunnel', 'van', 'wheel', 'sail', 'freight'],

	'yerler': ['bank', 'building', 'castle', 'church', 'cinema', 'city', 'college', 'country',
		'downtown', 'elevator', 'entrance', 'exit', 'fence', 'gate', 'gym', 'hotel', 'library',
		'mall', 'market', 'mosque', 'museum', 'neighbourhood', 'office', 'palace', 'park',
		'pharmacy', 'police station', 'pool', 'post office', 'restaurant', 'school', 'shelter',
		'shop', 'supermarket', 'temple', 'tent', 'theater', 'theatre', 'tower', 'town',
		'town hall', 'village', 'warehouse', 'yard', 'cabin', 'prison', 'jail'],

	'meslekler': ['accountant', 'actor', 'actress', 'agent', 'artist', 'assistant', 'attorney',
		'businessman', 'chef', 'coach', 'commander', 'detective', 'director', 'doctor',
		'engineer', 'fireman', 'housewife', 'lawyer', 'manager', 'mayor', 'minister', 'nurse',
		'pilot', 'police', 'police officer', 'president', 'professor', 'recruiter', 'scientist',
		'secretary', 'servant', 'singer', 'soldier', 'specialist', 'student', 'surgeon',
		'teacher', 'waiter', 'writer', 'author'],

	'okul ve iş': ['assignment', 'book', 'career', 'certificate', 'class', 'classroom',
		'client', 'company', 'contract', 'copy', 'department', 'document', 'employ', 'employee',
		'eraser', 'exam', 'factory', 'homework', 'industry', 'interview', 'job', 'lesson',
		'notebook', 'paper', 'pen', 'pencil', 'project', 'report', 'salary', 'staff', 'study',
		'teach', 'university', 'word', 'work', 'graduate', 'training', 'presentation'],

	'teknoloji': ['backup', 'big data', 'button', 'cable', 'camera', 'compiler', 'computer',
		'debug', 'decryption', 'defragment', 'device', 'devices', 'electricity', 'electronic',
		'encoding', 'encryption', 'file', 'firewalls', 'hardware', 'hashtag', 'internet',
		'interpreter', 'linker', 'machine', 'main board', 'motor', 'network', 'node',
		'operating system', 'peripherals', 'photo', 'processor', 'reboot', 'resistor', 'robot',
		'screen', 'shutdown', 'signal', 'software', 'storage', 'switch', 'video', 'plug'],

	'sanat ve eğlence': ['album', 'baseball', 'basketball', 'cartoon', 'champion', 'comedy',
		'concert', 'doll', 'drum', 'episode', 'festival', 'film', 'football', 'fun', 'game',
		'golf', 'guitar', 'imagination', 'jazz', 'league', 'legend', 'movie', 'music', 'novel',
		'opera', 'party', 'performance', 'piano', 'play', 'poem', 'poetry', 'prize', 'scene',
		'score', 'script', 'song', 'sport', 'stage', 'toy', 'tragedy', 'fantasy'],

	'toplum': ['army', 'battle', 'bomb', 'bullet', 'citizen', 'civil', 'community', 'council',
		'culture', 'duty', 'election', 'empire', 'enemy', 'freedom', 'generation', 'government',
		'kingdom', 'mission', 'nation', 'national', 'peace', 'permission', 'policy', 'political',
		'prince', 'princess', 'public', 'queen', 'religion', 'religious', 'responsibility',
		'revolution', 'society', 'soldier', 'sword', 'tradition', 'traditional', 'troops',
		'union', 'violence', 'war', 'weapon', 'military'],

	'hukuk': ['accuse', 'arrest', 'court', 'crime', 'criminal', 'evidence', 'guilty',
		'illegal', 'innocent', 'investigation', 'judge', 'jury', 'justice', 'law', 'legal',
		'murder', 'proof', 'punishment', 'steal', 'testimony', 'trial', 'victim', 'witness',
		'defendant', 'guard'],

	'duygular': ['afraid', 'angry', 'anxious', 'ashamed', 'awkward', 'bored', 'brave', 'calm',
		'cheerful', 'confidence', 'confident', 'comfort', 'depressed', 'desperate', 'emotion',
		'excited', 'fear', 'frightened', 'furious', 'glad', 'grateful', 'grief', 'guilt',
		'happiness', 'happy', 'hate', 'jealous', 'joy', 'lonely', 'love', 'loyal', 'miserable',
		'nervous', 'passion', 'patience', 'pride', 'proud', 'relief', 'sad', 'scared', 'shame',
		'shocked', 'shy', 'soul', 'spirit', 'stubborn', 'surprised', 'tired', 'uncomfortable',
		'upset', 'worry', 'foolish', 'suspicious', 'selfish', 'greedy', 'timid'],

	'renkler': ['black', 'blue', 'brown', 'color', 'colorless', 'golden', 'gray', 'green',
		'grey', 'orange', 'pink', 'purple', 'red', 'white', 'yellow', 'blond', 'blonde'],

	'zaman': ['afternoon', 'ago', 'anniversary', 'autumn', 'birthday', 'century', 'daily',
		'date', 'day', 'decade', 'early', 'evening', 'hour', 'late', 'midnight', 'minute',
		'month', 'monthly', 'morning', 'night', 'noon', 'now', 'nowadays', 'often', 'period',
		'second', 'soon', 'still', 'today', 'tomorrow', 'tonight', 'usually', 'week',
		'weekend', 'weekly', 'year', 'yearly', 'yesterday', 'yet', 'lifetime', 'quarter'],

	'malzemeler': ['blade', 'chain', 'cotton', 'crystal', 'diamond', 'dirt', 'dust', 'fabric',
		'flag', 'gold', 'hammer', 'iron', 'mask', 'metal', 'mud', 'net', 'pipe', 'plastic',
		'rope', 'silver', 'steel', 'stone', 'string', 'tool', 'wood', 'junk']
};

/**
 * İkinci tur konu grupları.
 *
 * Birinci tur (TOPIC_GROUPS) havuzun yalnızca dörtte birini kapsıyordu;
 * konu ekranı eklendikten sonra bu az kaldı. Buradaki gruplar hem yeni
 * alanlar açıyor (para, iletişim, spor, din, duyular, ölçü) hem de
 * mevcut alanları büyütüyor — aynı başlık ikinci kez yazılabilir,
 * kelimeler aynı konuya eklenir.
 *
 * Sıra önemli: ilk atama kazanır. Bu yüzden birinci tur önce işlenir,
 * oradaki elle doğrulanmış atamalar korunur.
 */
const TOPIC_GROUPS_EXTRA = {
	'para ve alışveriş': ['afford', 'bargain', 'bill', 'borrow', 'budget', 'cash', 'cheap',
		'coin', 'commerce', 'cost', 'credit', 'currency', 'customer', 'debt', 'discount',
		'expensive', 'fee', 'finance', 'financial', 'fund', 'income', 'insurance', 'invest',
		'invoice', 'lend', 'loan', 'owe', 'payment', 'price', 'profit', 'purchase', 'receipt',
		'refund', 'rent', 'sale', 'sell', 'shopping', 'spend', 'tax', 'trade', 'wealth',
		'wealthy', 'rich', 'coupon', 'auction', 'cheque', 'deposit', 'earn', 'economy',
		'economic', 'pay', 'store'],

	'iletişim': ['announce', 'answer', 'broadcast', 'call', 'channel', 'chat', 'comment',
		'communicate', 'communication', 'contact', 'conversation', 'describe', 'dial',
		'discuss', 'discussion', 'email', 'envelope', 'explain', 'express', 'greet',
		'inform', 'interview', 'invitation', 'invite', 'language', 'letter', 'mention',
		'message', 'phone', 'question', 'quote', 'radio', 'reply', 'request', 'respond',
		'response', 'shout', 'signature', 'speech', 'stamp', 'suggest', 'telephone',
		'translate', 'translation', 'whisper', 'address', 'TV', 'telegram'],

	'medya': ['advertisement', 'article', 'audience', 'blog', 'camera', 'cinema', 'column',
		'documentary', 'edition', 'editor', 'headline', 'journalist', 'magazine',
		'media', 'newspaper', 'news', 'photograph', 'photography', 'press', 'publish',
		'reporter', 'subscribe', 'television'],

	'din ve inanç': ['angel', 'belief', 'believer', 'bible', 'bless', 'blessing', 'ceremony',
		'devil', 'faith', 'ghost', 'god', 'heaven', 'hell', 'holy', 'miracle', 'monk',
		'moral', 'pray', 'prayer', 'preach', 'priest', 'prophet', 'ritual', 'sacred',
		'sacrifice', 'saint', 'sin', 'worship'],

	'spor': ['athlete', 'ball', 'boxing', 'chess', 'climb', 'coach', 'compete',
		'competition', 'cycling', 'defeat', 'dive', 'fitness', 'goal', 'gym', 'gymnastics',
		'jump', 'kick', 'marathon', 'match', 'medal', 'olympic', 'player', 'race', 'racing',
		'referee', 'runner', 'skate', 'ski', 'soccer', 'stadium', 'swim', 'swimming',
		'team', 'tennis', 'tournament', 'trophy', 'volleyball', 'wrestling'],

	'duyular': ['aroma', 'bitter', 'blind', 'bright', 'dim', 'echo', 'fragrance', 'glance',
		'glow', 'loud', 'noise', 'observe', 'quiet', 'rough', 'salty', 'scent',
		'silence', 'silent', 'smell', 'smooth', 'sniff', 'soft', 'sight', 'sound', 'sour',
		'spicy', 'stare', 'sweet', 'taste', 'texture', 'touch', 'visible', 'vision', 'voice'],

	'miktar ve ölçü': ['amount', 'average', 'centimetre', 'degree', 'depth', 'dozen',
		'enough', 'gallon', 'gram', 'height', 'inch', 'kilogram', 'kilometre', 'length',
		'litre', 'majority', 'measure', 'measurement', 'metre', 'mile', 'minority', 'ounce',
		'percent', 'percentage', 'plenty', 'portion', 'quantity', 'ratio', 'scale', 'size',
		'ton', 'total', 'volume', 'weigh', 'weight', 'width', 'yard', 'level', 'double',
		'triple', 'maximum', 'minimum'],

	'bilim': ['acid', 'analysis', 'atom', 'biology', 'cell', 'chemical', 'chemistry',
		'data', 'discovery', 'element', 'energy', 'evolution', 'experiment',
		'formula', 'galaxy', 'gene', 'gravity', 'hypothesis', 'laboratory', 'lab',
		'liquid', 'magnet', 'mathematics', 'method', 'microscope', 'molecule', 'orbit',
		'oxygen', 'particle', 'physics', 'planet', 'research', 'satellite', 'solid',
		'species', 'substance', 'telescope', 'theory', 'universe', 'science'],

	'hukuk': ['agreement', 'attorney', 'authority', 'ban', 'burglar', 'confess', 'convict',
		'custody', 'defend', 'fine', 'fraud', 'gang', 'gun', 'hostage', 'kidnap', 'kill',
		'lawsuit', 'legislation', 'penalty', 'pistol', 'prosecutor', 'ransom', 'regulation',
		'revenge', 'rifle', 'robbery', 'sentence', 'sheriff', 'smuggle', 'suicide',
		'suspect', 'theft', 'thief', 'threat', 'weapon'],

	'sağlık': ['allergy', 'bandage', 'breathe', 'cough', 'dentist', 'diagnosis', 'dizzy',
		'drug', 'emergency', 'fatigue', 'flu', 'fracture', 'infection', 'injection',
		'injury', 'operation', 'pharmacy', 'physical', 'prescription', 'recover',
		'recovery', 'sneeze', 'suffer', 'swallow', 'symptom', 'tablet', 'treatment',
		'vaccine', 'vitamin', 'ward', 'wheelchair', 'ill', 'illness'],

	'duygular': ['admire', 'affection', 'amazed', 'amuse', 'annoyed', 'anxiety', 'apologize',
		'appreciate', 'blame', 'bother', 'complain', 'concern', 'courage', 'delight',
		'despair', 'disappointed', 'disgust', 'doubt', 'eager', 'embarrassed', 'enjoy',
		'enthusiasm', 'envy', 'excitement', 'forgive', 'frustrated', 'giggle',
		'hesitate', 'hopeful', 'hostile', 'humiliate', 'impress', 'laugh', 'laughter',
		'mercy', 'mood', 'nostalgia', 'optimistic', 'panic', 'pessimistic',
		'pity', 'pleasure', 'regret', 'rejoice', 'resent', 'satisfied', 'smile', 'sorrow',
		'sympathy', 'tears', 'tender', 'terrified', 'thrill', 'weep', 'worried'],

	'insanlar': ['acquaintance', 'adult', 'boy', 'buddy', 'colleague', 'companion',
		'crowd', 'fellow', 'female', 'folk', 'friend', 'friendship', 'gentleman',
		'girl', 'guest', 'guy', 'human', 'individual', 'kid', 'lady', 'male', 'man',
		'mate', 'neighbour', 'neighbor', 'partner', 'people', 'person', 'population',
		'stranger', 'teenager', 'woman', 'youth'],

	'ev': ['blanket', 'broom', 'bucket', 'candle', 'ceiling', 'chair', 'chimney',
		'corridor', 'cupboard', 'cushion', 'drawer', 'fireplace', 'fork', 'hall', 'jar',
		'kettle', 'knife', 'ladder', 'mattress', 'pillow', 'pot', 'shelf', 'sink', 'soap',
		'spoon', 'stove', 'towel', 'tray', 'vacuum', 'wardrobe', 'sweep', 'tidy',
		'upstairs', 'downstairs', 'flat', 'household'],

	'okul ve iş': ['achievement', 'agenda', 'application', 'appointment', 'board', 'boss',
		'candidate', 'conference', 'deadline', 'diploma', 'discipline',
		'education', 'employer', 'employment', 'grade', 'headmaster',
		'knowledge', 'learn', 'lecture', 'management', 'meeting', 'notes',
		'organization', 'performance', 'practice', 'principal', 'profession', 'promotion',
		'qualification', 'resign', 'retire', 'schedule', 'scholarship',
		'skill', 'subject', 'success', 'task', 'teamwork', 'training', 'workplace'],

	'teknoloji': ['algorithm', 'antenna', 'app', 'battery', 'browser', 'chip',
		'circuit', 'click', 'code', 'database', 'digital', 'download',
		'folder', 'gadget', 'install', 'keyboard', 'laptop', 'link', 'memory',
		'monitor', 'online', 'password', 'platform', 'printer', 'program',
		'programming', 'remote', 'server', 'system', 'update', 'upload', 'username',
		'virtual', 'website', 'wire', 'wireless'],

	'yerler': ['avenue', 'balcony', 'bridge', 'campus', 'capital', 'cemetery',
		'clinic', 'club', 'corner', 'farm', 'fountain', 'harbour', 'lane',
		'lobby', 'monument', 'motel', 'nightclub', 'playground', 'port', 'region',
		'ruins', 'salon', 'square', 'studio', 'suburb', 'terrace', 'venue',
		'zoo', 'field', 'ground'],

	'ulaşım': ['accident', 'anchor', 'brake', 'cargo', 'crash', 'cruise', 'departure',
		'destination', 'fare', 'fuel', 'gasoline', 'horn', 'motorcycle', 'parking',
		'passenger', 'petrol', 'ride', 'route', 'seatbelt', 'steering', 'tire', 'tyre',
		'transport', 'vehicle', 'voyage', 'wagon', 'seat'],

	'doğa ve hava': ['blossom', 'branch', 'breeze', 'bush', 'canyon', 'climate', 'creek',
		'dawn', 'drought', 'dusk', 'environment', 'flood', 'frost', 'glacier', 'hurricane',
		'jungle', 'leaf', 'meadow', 'mist', 'nature', 'peak', 'pollution', 'pond', 'rainbow',
		'root', 'shade', 'shadow', 'soil', 'stream', 'sunlight', 'sunrise', 'sunset',
		'sunshine', 'swamp', 'temperature', 'thunderstorm', 'tide', 'volcano', 'waterfall',
		'wave', 'wilderness'],

	'yiyecek ve içecek': ['bacon', 'berry', 'biscuit', 'boil', 'bottle', 'cabbage',
		'cereal', 'cherry', 'chop', 'coconut', 'cucumber', 'dessert', 'dish',
		'dough', 'feast', 'flavour', 'fry', 'garlic', 'grape', 'grill', 'honey', 'jam',
		'ketchup', 'lemon', 'lettuce', 'menu', 'mushroom', 'mustard', 'noodle', 'nut',
		'olive', 'pasta', 'peach', 'pear', 'plum', 'recipe', 'roast',
		'sausage', 'seafood', 'snack', 'spice', 'spinach', 'strawberry', 'toast',
		'vanilla', 'vinegar', 'watermelon', 'yogurt', 'appetite', 'glass'],

	'vücut': ['bald', 'breast', 'eyelash', 'eyelid', 'fingernail', 'forehead', 'heel',
		'hip', 'jaw', 'joint', 'kidney', 'liver', 'lung', 'nerve', 'organ', 'rib',
		'skull', 'spine', 'thumb', 'vein', 'waist', 'breathing'],

	'hayvanlar': ['ant', 'butterfly', 'camel', 'cricket', 'crocodile', 'deer',
		'dolphin', 'donkey', 'dove', 'eagle', 'feather', 'fox', 'frog', 'goose',
		'hen', 'kitten', 'lizard', 'mosquito', 'moth', 'owl', 'parrot', 'paw', 'pigeon',
		'puppy', 'rooster', 'spider', 'squirrel', 'swan', 'turtle', 'whale',
		'worm', 'zebra', 'nest', 'claw', 'fur'],

	'giysi': ['apron', 'blouse', 'cap', 'collar', 'fashion', 'glove', 'hood',
		'jewellery', 'lace', 'leather', 'outfit', 'pyjamas', 'ribbon',
		'sandal', 'sew', 'silk', 'sleeve', 'slipper', 'sneaker', 'sock', 'stocking',
		'wool', 'zip'],

	'aile': ['ancestor', 'bride', 'engagement', 'granddaughter', 'grandparent',
		'grandson', 'heir', 'orphan', 'relative', 'sibling', 'stepfather', 'stepmother',
		'widow', 'birth', 'pregnancy'],

	'toplum': ['ambassador', 'campaign', 'charity', 'colony', 'conflict', 'congress',
		'constitution', 'debate', 'democracy', 'diplomat', 'equality', 'ethnic', 'federal',
		'immigrant', 'independence', 'liberty', 'parliament', 'politics', 'poverty',
		'protest', 'refugee', 'republic', 'senate', 'slavery', 'strike', 'territory',
		'treaty', 'vote', 'welfare'],

	'meslekler': ['architect', 'baker', 'barber', 'butcher', 'captain', 'carpenter',
		'cashier', 'chief', 'cleaner', 'clerk', 'consultant', 'designer', 'electrician',
		'farmer', 'guide', 'inspector', 'librarian', 'mechanic', 'merchant', 'miner',
		'musician', 'officer', 'painter', 'photographer', 'plumber', 'programmer',
		'receptionist', 'researcher', 'salesman', 'shepherd', 'tailor', 'technician',
		'therapist', 'translator', 'trainer', 'waitress'],

	'sanat ve eğlence': ['applause', 'ballet', 'band', 'canvas', 'cast', 'chapter',
		'choir', 'circus', 'dance', 'draw', 'drawing', 'exhibition', 'gallery', 'hobby',
		'humour', 'instrument', 'joke', 'lyrics', 'magic', 'melody', 'orchestra', 'paint',
		'painting', 'plot', 'poet', 'puzzle', 'rhythm', 'sculpture', 'series', 'sing',
		'singer', 'sketch', 'statue', 'tune', 'violin'],

	'zaman': ['annual', 'calendar', 'clock', 'delay', 'duration', 'era', 'eventually',
		'forever', 'frequency', 'frequent', 'future', 'immediately', 'instant', 'interval',
		'meanwhile', 'moment', 'occasionally', 'past', 'permanent', 'previous', 'rarely',
		'recent', 'recently', 'season', 'seldom', 'temporary', 'timetable', 'urgent'],

	'yer ve yön': ['above', 'across', 'ahead', 'apart', 'backward', 'behind',
		'below', 'beneath', 'beside', 'border', 'bottom', 'centre', 'compass',
		'direction', 'distance', 'east', 'edge', 'forward', 'front', 'inside',
		'middle', 'north', 'opposite', 'outside', 'south', 'surface', 'upward',
		'west', 'position'],

	'malzemeler': ['aluminium', 'brick', 'bronze', 'cement', 'clay', 'concrete', 'copper',
		'fibre', 'foam', 'glue', 'grain', 'marble', 'plaster', 'powder', 'rubber', 'rust',
		'screw', 'thread', 'tin', 'wax'],

	'günlük konuşma': ['bye', 'cheers', 'congratulations', 'excuse', 'goodbye', 'greeting',
		'okay', 'pardon', 'please', 'regards', 'sorry', 'thanks', 'welcome', 'wow', 'sir',
		'madam']
};

/**
 * Sozcuk turunden dogrudan cikan konular.
 *
 * Zamir, edat, baglac ve belirtec anlam tasimaz; islevleri dilbilgiseldir.
 * Bunlari "dilbilgisi" altinda toplamak hem dogru hem de ise yarar:
 * ogrenci "of / to / through" gibi kelimeleri birlikte calisir.
 */
const TOPIC_BY_POS = {
	pronoun: 'dilbilgisi',
	preposition: 'dilbilgisi',
	conjunction: 'dilbilgisi',
	determiner: 'dilbilgisi',
	number: 'sayılar',
	ordinal: 'sayılar',
	interjection: 'günlük konuşma'
};

/**
 * "Temel" gruplarin siklik siniri.
 *
 * "temel fiiller" adi zaten bir siklik iddiasi: en cok kullanilan
 * fiiller demek. Bu yuzden konusuz kalan sik fiil/sifat/zarflar
 * otomatik olarak bu gruplara giriyor. Sinirin disindakiler
 * ("abandon", "accumulate") konusuz kaliyor - dogrusu da bu, cunku
 * onlar "temel" degil.
 *
 * 1500, listedeki her grubun 100-300 kelimeye ulastigi ve calisilabilir
 * kaldigi nokta; daha genisi grubu anlamsizlastiriyor.
 */
const BASIC_FREQ_LIMIT = 1500;
const TOPIC_BY_BASIC_POS = {
	verb: 'temel fiiller',
	adjective: 'temel sıfatlar',
	adverb: 'dilbilgisi'
};

const topicByWord = new Map();
for (const groups of [TOPIC_GROUPS, TOPIC_GROUPS_EXTRA]) {
	for (const [topic, words] of Object.entries(groups)) {
		for (const w of words) {
			const key = w.toLowerCase();
			// İlk atama kazanır: gruplar öncelik sırasına göre yazıldı
			if (!topicByWord.has(key)) topicByWord.set(key, topic);
		}
	}
}

// ===================== Çalıştır =====================

const posMap = {};
const topicMap = {};
const byReason = {};
let posFilled = 0;
let posKept = 0;
let topicFilled = 0;
let topicKept = 0;

for (const w of pack.words) {
	const key = w.en;

	if (manualPos.has(key)) {
		posMap[key] = manualPos.get(key);
		posKept++;
	} else {
		const inferred = inferPos(w);
		if (inferred) {
			posMap[key] = inferred.pos;
			byReason[inferred.why] = (byReason[inferred.why] || 0) + 1;
			posFilled++;
		}
	}

	if (manualTopic.has(key)) {
		topicMap[key] = manualTopic.get(key);
		topicKept++;
	} else {
		// Oncelik: elle yazilan liste > sozcuk turu > siklik esigi.
		// Anlamli bir konu her zaman islevsel bir konudan iyidir.
		// posMap yalnizca bu betigin cikarsadiklarini tutar; pakette
		// Oxford listesinden gelen turler de var. Konu icin ikisi de
		// gecerli - burada tur cikarsamiyoruz, sadece kullaniyoruz.
		const pos = posMap[key] || w.pos;
		const rank = w.freqRank || Number.MAX_SAFE_INTEGER;
		const topic =
			topicByWord.get(w.en.toLowerCase()) ||
			TOPIC_BY_POS[pos] ||
			(rank <= BASIC_FREQ_LIMIT ? TOPIC_BY_BASIC_POS[pos] : null);
		if (topic) {
			topicMap[key] = topic;
			topicFilled++;
		}
	}
}

const total = pack.words.length;
const posCovered = Object.keys(posMap).length;
const topicCovered = Object.keys(topicMap).length;

console.log('=== SÖZCÜK TÜRÜ ===');
console.log(`  Zaten vardı  : ${posKept}`);
console.log(`  Çıkarsanan   : ${posFilled}`);
console.log(`  Toplam kapsam: ${posCovered} / ${total}  (%${((posCovered / total) * 100).toFixed(1)})`);
console.log('  Çıkarım kaynağı:');
for (const [why, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
	console.log(`    ${why.padEnd(18)} ${count}`);
}

const posDist = {};
for (const p of Object.values(posMap)) posDist[p] = (posDist[p] || 0) + 1;
console.log('  Dağılım:', Object.entries(posDist).sort((a, b) => b[1] - a[1])
	.map(([k, v]) => `${k}:${v}`).join('  '));

console.log('');
console.log('=== KONU ===');
console.log(`  Zaten vardı  : ${topicKept}`);
console.log(`  Eşleşen      : ${topicFilled}`);
console.log(`  Toplam kapsam: ${topicCovered} / ${total}  (%${((topicCovered / total) * 100).toFixed(1)})`);
console.log(`  Konusuz kalan: ${total - topicCovered} — genel/soyut kelimeler, bu normal`);

if (DRY) {
	console.log('\n(--dry: dosya yazılmadı)');
} else {
	writeFileSync(OUT, JSON.stringify({
		_comment: 'Sözcük türü ve konu eşlemesi. scripts/infer-pos.mjs üretir, paket üreticisi okur. Elle düzenlenebilir.',
		_coverage: { pos: posCovered, topic: topicCovered, total },
		pos: posMap,
		topic: topicMap
	}, null, 1), 'utf8');
	console.log('\n  Yazıldı: data/pos-map.json');
}
