/**
 * Alıştırma motorunun testleri.
 *
 * Kritik sözleşme: cevap gerçekten denetlenmeli. Öz-değerlendirmenin
 * yerini alan mekanizma yanlış cevabı doğru sayarsa, sistem eskisinden
 * daha kötü olur.
 */
import { describe, expect, it } from 'vitest';
import {
	buildExercise,
	checkAnswer,
	editDistance,
	findSurfaceForm,
	isNearMiss,
	pickType,
	TYPES
} from '../src/core/exercise.js';

const noShuffle = () => 0;

function word(overrides = {}) {
	return {
		id: 'w1',
		en: 'abandon',
		tr: 'terk etmek',
		example: 'He decided to abandon law for art.',
		exampleTr: 'O sanat için hukuku terk etmeye karar verdi.',
		synonyms: [],
		cefr: 'B2',
		level: 0,
		interval: 0,
		reps: 0,
		history: [],
		...overrides
	};
}

/** Yanıltıcı havuzu. */
function pool(n = 12, cefr = 'B2') {
	return Array.from({ length: n }, (_, i) => word({
		id: 'd' + i,
		en: 'word' + i,
		tr: 'anlam' + i,
		cefr
	}));
}

describe('findSurfaceForm', () => {
	it('kelimeyi cümlede bulur', () => {
		const f = findSurfaceForm('abandon', 'He decided to abandon law.');
		expect(f.form).toBe('abandon');
		expect(f.index).toBe(14);
	});

	it('çekimli biçimi bulur', () => {
		expect(findSurfaceForm('bury', 'Our dog buries bones.').form).toBe('buries');
		expect(findSurfaceForm('decide', 'She decided quickly.').form).toBe('decided');
		expect(findSurfaceForm('run', 'He is running fast.').form).toBe('running');
	});

	it('kelime sınırına saygı duyar', () => {
		// "art" -> "start" içinde eşleşmemeli
		expect(findSurfaceForm('art', 'Let us start now.')).toBeNull();
	});

	it('çok kelimeli ifadelerde null döner', () => {
		expect(findSurfaceForm('look up', 'I will look up the word.')).toBeNull();
	});

	it('bulunamayınca null döner', () => {
		expect(findSurfaceForm('xyzzy', 'Nothing here.')).toBeNull();
		expect(findSurfaceForm('', 'Nothing here.')).toBeNull();
		expect(findSurfaceForm('word', '')).toBeNull();
	});
});

describe('pickType', () => {
	it('yeni kelimede tanıma sorusu seçer', () => {
		expect(pickType(word({ reps: 0, interval: 0 }), { random: noShuffle }))
			.toBe(TYPES.CHOICE_EN_TR);
	});

	it('birkaç tekrardan sonra üretim yönüne geçer', () => {
		expect(pickType(word({ reps: 1, interval: 1 }), { random: noShuffle }))
			.toBe(TYPES.CHOICE_TR_EN);
		expect(pickType(word({ reps: 2, interval: 3 }), { random: noShuffle }))
			.toBe(TYPES.CHOICE_TR_EN);
	});

	it('olgunlaşınca gerçek üretim ister', () => {
		const type = pickType(word({ reps: 4, interval: 8 }), { random: noShuffle });
		expect([TYPES.CLOZE, TYPES.TYPE_EN]).toContain(type);
	});

	it('cümlesi olmayan kelimede boşluk doldurma seçmez', () => {
		const type = pickType(word({ reps: 4, interval: 8, example: '' }), { random: noShuffle });
		expect(type).toBe(TYPES.TYPE_EN);
	});

	it('olgun kelimede bakım moduna geçer', () => {
		expect(pickType(word({ reps: 9, interval: 60 }), { random: noShuffle }))
			.toBe(TYPES.RECALL);
	});
});

describe('buildExercise - çoktan seçmeli', () => {
	it('EN->TR sorusu üretir', () => {
		const ex = buildExercise(word(), pool(), { type: TYPES.CHOICE_EN_TR, random: noShuffle });
		expect(ex.prompt).toBe('abandon');
		expect(ex.options).toHaveLength(4);
		expect(ex.options[ex.correctIndex]).toBe('terk etmek');
	});

	it('TR->EN sorusu üretir (üretim yönü)', () => {
		const ex = buildExercise(word(), pool(), { type: TYPES.CHOICE_TR_EN, random: noShuffle });
		expect(ex.prompt).toBe('terk etmek');
		expect(ex.options[ex.correctIndex]).toBe('abandon');
	});

	it('doğru cevabı yanıltıcı olarak tekrarlamaz', () => {
		const ex = buildExercise(word(), pool(), { type: TYPES.CHOICE_EN_TR, random: noShuffle });
		expect(new Set(ex.options).size).toBe(ex.options.length);
	});

	it('aynı anlamlı yanıltıcı üretmez', () => {
		// İki doğru cevabı olan soru olmamalı
		const dupes = [word({ id: 'x', tr: 'terk etmek' }), ...pool(6)];
		const ex = buildExercise(word(), dupes, { type: TYPES.CHOICE_EN_TR, random: noShuffle });
		expect(ex.options.filter((o) => o === 'terk etmek')).toHaveLength(1);
	});

	it('havuz küçükse çöker değil, az seçenekle döner', () => {
		const ex = buildExercise(word(), pool(1), { type: TYPES.CHOICE_EN_TR, random: noShuffle });
		expect(ex.options.length).toBeGreaterThanOrEqual(2);
		expect(ex.options[ex.correctIndex]).toBe('terk etmek');
	});
});

describe('buildExercise - boşluk doldurma', () => {
	it('cümleyi boşlukla böler', () => {
		const ex = buildExercise(word(), pool(), { type: TYPES.CLOZE, random: noShuffle });
		expect(ex.type).toBe(TYPES.CLOZE);
		expect(ex.sentence.before).toBe('He decided to ');
		expect(ex.sentence.after).toBe(' law for art.');
		expect(ex.sentence.blank).toBe('abandon');
	});

	it('Türkçe çeviriyi ipucu olarak taşır', () => {
		const ex = buildExercise(word(), pool(), { type: TYPES.CLOZE, random: noShuffle });
		expect(ex.sentenceTr).toContain('hukuku');
	});

	it('cümlede kelime yoksa yazmaya düşer', () => {
		const w = word({ example: 'Totally unrelated sentence here.' });
		const ex = buildExercise(w, pool(), { type: TYPES.CLOZE, random: noShuffle });
		expect(ex.type).toBe(TYPES.TYPE_EN);
	});

	it('çekimli biçimi ve kökü birlikte kabul eder', () => {
		const w = word({ en: 'bury', tr: 'gömmek', example: 'Our dog buries bones here.' });
		const ex = buildExercise(w, pool(), { type: TYPES.CLOZE, random: noShuffle });
		expect(ex.sentence.blank).toBe('buries');
		expect(checkAnswer(ex, 'buries').correct).toBe(true);
		expect(checkAnswer(ex, 'bury').correct).toBe(true);
	});
});

describe('checkAnswer', () => {
	const choice = buildExercise(word(), pool(), { type: TYPES.CHOICE_EN_TR, random: noShuffle });
	const typed = buildExercise(word(), pool(), { type: TYPES.TYPE_EN, random: noShuffle });

	it('doğru şıkkı kabul eder', () => {
		expect(checkAnswer(choice, choice.correctIndex).correct).toBe(true);
		expect(checkAnswer(choice, choice.correctIndex).rating).toBe('good');
	});

	it('yanlış şıkkı reddeder', () => {
		const wrong = (choice.correctIndex + 1) % choice.options.length;
		expect(checkAnswer(choice, wrong).correct).toBe(false);
		expect(checkAnswer(choice, wrong).rating).toBe('again');
	});

	it('yazılan doğru cevabı kabul eder', () => {
		expect(checkAnswer(typed, 'abandon').correct).toBe(true);
	});

	it('büyük/küçük harf ve boşluk farkını yok sayar', () => {
		expect(checkAnswer(typed, '  ABANDON  ').correct).toBe(true);
		expect(checkAnswer(typed, 'Abandon').correct).toBe(true);
	});

	it('noktalamayı yok sayar', () => {
		expect(checkAnswer(typed, 'abandon.').correct).toBe(true);
	});

	it('harf hatasını KABUL ETMEZ', () => {
		// Yazımı da öğrenmek gerekiyor; "yakın" yeterli değil.
		expect(checkAnswer(typed, 'abandonn').correct).toBe(false);
		expect(checkAnswer(typed, 'abandan').correct).toBe(false);
	});

	it('boş cevabı reddeder', () => {
		expect(checkAnswer(typed, '').correct).toBe(false);
		expect(checkAnswer(typed, '   ').correct).toBe(false);
	});

	it('eş anlamlıyı kabul eder', () => {
		const w = word({ en: 'accuse', tr: 'suçlamak', synonyms: ['blame', 'charge'] });
		const ex = buildExercise(w, pool(), { type: TYPES.TYPE_EN, random: noShuffle });
		expect(checkAnswer(ex, 'blame').correct).toBe(true);
		expect(checkAnswer(ex, 'accuse').correct).toBe(true);
	});
});

describe('isNearMiss', () => {
	const typed = buildExercise(word(), pool(), { type: TYPES.TYPE_EN, random: noShuffle });

	it('tek harf hatasını yakalar', () => {
		expect(isNearMiss(typed, 'abandonn')).toBe(true);
		expect(isNearMiss(typed, 'abandn')).toBe(true);
	});

	it('doğru cevap yakın-ıska değildir', () => {
		expect(isNearMiss(typed, 'abandon')).toBe(false);
	});

	it('tamamen farklı cevap yakın-ıska değildir', () => {
		expect(isNearMiss(typed, 'banana')).toBe(false);
	});

	it('çoktan seçmelide anlamsız, false döner', () => {
		const choice = buildExercise(word(), pool(), { type: TYPES.CHOICE_EN_TR, random: noShuffle });
		expect(isNearMiss(choice, 0)).toBe(false);
	});
});

describe('editDistance', () => {
	it('bilinen değerleri verir', () => {
		expect(editDistance('kitten', 'sitting')).toBe(3);
		expect(editDistance('abc', 'abc')).toBe(0);
		expect(editDistance('', 'abc')).toBe(3);
		expect(editDistance('abc', '')).toBe(3);
	});
});
