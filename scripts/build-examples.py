# -*- coding: utf-8 -*-
"""
Tatoeba'dan her kelime icin en uygun ornek cumleyi secer.

Kaynak: Tatoeba (https://tatoeba.org), CC BY 2.0 FR.
Ticari kullanima acik; atif zorunlu. Atif uygulama icinde
Ayarlar > Kaynaklar bolumunde ve README'de veriliyor.

Neden Python: Tatoeba dosyalari bz2 sikistirilmis, Node'da yerlesik
bz2 destegi yok. Cikti data/examples.json; paket ureticisi (Node)
onu okuyor.

Calistirma:
    python scripts/build-examples.py
    python scripts/build-examples.py --limit 200   (hizli deneme)
"""
import bz2
import io
import json
import os
import re
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "sources")
PACK = os.path.join(ROOT, "public", "content", "core-v1.json")
CEFR = os.path.join(ROOT, "data", "cefr-levels.json")
OUT = os.path.join(ROOT, "data", "examples.json")

LIMIT = None
if "--limit" in sys.argv:
    LIMIT = int(sys.argv[sys.argv.index("--limit") + 1])

CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]
CEFR_INDEX = {l: i for i, l in enumerate(CEFR_ORDER)}

# Cumle uzunlugu: cok kisa baglam vermez, cok uzun okumayi zorlastirir.
MIN_WORDS, MAX_WORDS, IDEAL_WORDS = 4, 12, 7

TOKEN_RE = re.compile(r"[a-zA-Z']+")

# Tireli bilesigi TEK belirtec sayar.
#
# TOKEN_RE tireyi ayirici sayiyor, bu yuzden "ten-year-old" icinden
# "old" eslesiyordu ve `old` kelimesinin ornek cumlesi
# "They have a ten-year-old son." oluyordu. Kelime cumlede tek basina
# gecmedigi icin bosluk doldurma alistirmasi da onu bulamiyor.
# 44 kelime bu durumdaydi (old, three, seek, sky, split...).
WHOLE_TOKEN_RE = re.compile(r"[a-zA-Z']+(?:-[a-zA-Z']+)*")


def log(msg):
    print(msg, flush=True)


# ===================== Girdi =====================

log("Paket ve seviye tablosu okunuyor...")
pack = json.load(io.open(PACK, encoding="utf-8"))
cefr_data = json.load(io.open(CEFR, encoding="utf-8"))

# Kelime -> CEFR indeksi (cumle zorlugu puanlamasi icin)
word_level = {}
for level, words in cefr_data.items():
    if level.startswith("_"):
        continue
    for w in words:
        word_level[w.lower()] = CEFR_INDEX[level]

pack_words = pack["words"]
if LIMIT:
    pack_words = pack_words[:LIMIT]


def inflections(word):
    """Bir kelimenin cumlede gecebilecek yaygin bicimleri."""
    w = word.lower()
    forms = {w}
    if not w.isalpha():
        return forms
    forms.add(w + "s")
    if w.endswith(("s", "x", "z", "ch", "sh")):
        forms.add(w + "es")
    if w.endswith("y") and len(w) > 2 and w[-2] not in "aeiou":
        forms.add(w[:-1] + "ies")
    if w.endswith("e"):
        forms.add(w + "d")
        forms.add(w[:-1] + "ing")
    else:
        forms.add(w + "ed")
        forms.add(w + "ing")
    return forms


# Tek kelimeler: yuzey bicimi -> hedef kelime kimligi
surface_to_word = defaultdict(list)
# Cok kelimeli ifadeler: ilk sozcuk -> [(ifade, kimlik)]
phrase_by_first = defaultdict(list)

for w in pack_words:
    en = w["en"].strip()
    key = en.lower()
    if " " in key or "-" in key:
        first = TOKEN_RE.findall(key)
        if first:
            phrase_by_first[first[0]].append((key, w["id"]))
    else:
        for form in inflections(en):
            surface_to_word[form].append(w["id"])

target_level = {w["id"]: CEFR_INDEX.get(w.get("cefr") or "B1", 2) for w in pack_words}
target_en = {w["id"]: w["en"] for w in pack_words}

log("  hedef kelime: %d (tek: %d yuzey bicimi, ifade: %d)"
    % (len(pack_words), len(surface_to_word), sum(len(v) for v in phrase_by_first.values())))


# ===================== Tatoeba =====================

def read_sentences(path, wanted_ids=None):
    """id -> metin. wanted_ids verilirse yalnizca onlari tutar."""
    out = {}
    with bz2.open(path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 3:
                continue
            sid = parts[0]
            if wanted_ids is not None and sid not in wanted_ids:
                continue
            out[sid] = parts[2]
    return out


log("Ceviri baglantilari okunuyor...")
# tur_id -> eng_id ; ayni Ingilizce cumlenin birden fazla cevirisi olabilir,
# ilkini alip gecmek yeterli.
eng_to_tur = {}
tur_ids = set()
with bz2.open(os.path.join(SRC, "tur-eng_links.tsv.bz2"), "rt", encoding="utf-8") as f:
    for line in f:
        parts = line.rstrip("\n").split("\t")
        if len(parts) != 2:
            continue
        tur_id, eng_id = parts
        if eng_id not in eng_to_tur:
            eng_to_tur[eng_id] = tur_id
            tur_ids.add(tur_id)
log("  cevirisi olan Ingilizce cumle: %d" % len(eng_to_tur))

log("Turkce cumleler okunuyor...")
tur_text = read_sentences(os.path.join(SRC, "tur_sentences.tsv.bz2"), tur_ids)
log("  %d Turkce cumle" % len(tur_text))


# ===================== Puanlama =====================

# Tatoeba'nin yer tutucu karakterleri. Yasaklamiyoruz - cok yaygin
# olduklari icin dislamak kapsami ciddi dusururdu - ama esit puanda
# icinde gecmeyen cumle tercih edilsin.
PLACEHOLDER_NAMES = {"tom", "mary", "john", "jane", "bob", "ken", "nancy"}


def score_sentence(tokens, level_idx):
    """
    Dusuk puan = daha iyi ornek.

    Iki sey onemli: cumle hedef kelimenin seviyesine uygun olmali
    (A1 kelimesi C1 cumlesinde ogretilmez) ve okunabilir uzunlukta
    olmali.
    """
    n = len(tokens)
    penalty = abs(n - IDEAL_WORDS) * 1.5

    for t in tokens:
        if t in PLACEHOLDER_NAMES:
            penalty += 1.5
            continue
        lv = word_level.get(t)
        if lv is None:
            # Havuzda olmayan kelime: ozel ad ya da kapsam disi.
            penalty += 2.0
        elif lv > level_idx:
            # Hedeften daha ileri seviye kelime
            penalty += (lv - level_idx) * 1.5
    return penalty


log("Ingilizce cumleler taraniyor ve eslestiriliyor...")

# kelime kimligi -> (puan, eng_id, eng_text)
best = {}
scanned = 0
matched = 0

with bz2.open(os.path.join(SRC, "eng_sentences.tsv.bz2"), "rt", encoding="utf-8", errors="replace") as f:
    for line in f:
        parts = line.rstrip("\n").split("\t")
        if len(parts) < 3:
            continue
        eng_id, text = parts[0], parts[2]

        tur_id = eng_to_tur.get(eng_id)
        if tur_id is None or tur_id not in tur_text:
            continue

        scanned += 1
        if scanned % 100000 == 0:
            log("  ... %d cumle tarandi, %d kelime eslesti" % (scanned, len(best)))

        tokens = [t.lower() for t in TOKEN_RE.findall(text)]
        # Tek kelime eslesmesi bilesigi bolmeden yapilmali
        whole_tokens = {t.lower() for t in WHOLE_TOKEN_RE.findall(text)}
        n = len(tokens)
        if n < MIN_WORDS or n > MAX_WORDS:
            continue

        # Iyi bicimli cumle: buyuk harfle baslasin, noktalama ile bitsin
        if not text[:1].isupper() or text[-1] not in ".!?":
            continue

        lower = text.lower()
        hits = set()

        # Tek kelimeler: bilesigin parcasi sayilmaz
        for t in whole_tokens:
            for wid in surface_to_word.get(t, ()):
                hits.add(wid)

        # Cok kelimeli ifadeler: yalnizca ilk sozcugu tutan cumlelerde ara.
        # Burada bolunmus belirtecler kullaniliyor cunku phrase_by_first
        # anahtarlari tek sozcuk ("t-shirt" -> "t").
        for t in set(tokens):
            for phrase, wid in phrase_by_first.get(t, ()):
                if phrase in lower:
                    hits.add(wid)

        if not hits:
            continue
        matched += 1

        for wid in hits:
            s = score_sentence(tokens, target_level[wid])
            cur = best.get(wid)
            if cur is None or s < cur[0]:
                best[wid] = (s, eng_id, text)

log("  tarama bitti: %d uygun cumle, %d kelime icin ornek bulundu" % (scanned, len(best)))


# ===================== Cikti =====================

examples = {}
for wid, (score, eng_id, en_text) in best.items():
    tur_id = eng_to_tur.get(eng_id)
    tr_text = tur_text.get(tur_id)
    if not tr_text:
        continue
    examples[target_en[wid]] = {
        "en": en_text,
        "tr": tr_text,
        "id": int(eng_id),
        "score": round(score, 1)
    }

payload = {
    "_source": "Tatoeba (https://tatoeba.org) - CC BY 2.0 FR",
    "_note": "Otomatik secildi: scripts/build-examples.py. Kelime -> ornek cumle.",
    "_generated": len(examples),
    "examples": dict(sorted(examples.items())),
}

io.open(OUT, "w", encoding="utf-8", newline="\n").write(
    json.dumps(payload, ensure_ascii=False, indent=1)
)

covered = len(examples)
total = len(pack_words)
log("")
log("=== SONUC ===")
log("  Ornek bulunan kelime : %d / %d  (%%%.1f)" % (covered, total, covered * 100.0 / total))
log("  Yazildi: data/examples.json (%.0f KB)" % (os.path.getsize(OUT) / 1024))
