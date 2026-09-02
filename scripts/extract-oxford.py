# -*- coding: utf-8 -*-
"""
Oxford CEFR liste PDF'lerini ayristirir.

Bicim (her satir):
    kelime  anlam1 [tur]  anlam2 [tur]  anlam3 [tur]

Tur kisaltmalari Turkce dilbilgisi terimleri:
    [i.]   isim        [f.]  fiil
    [s.]   sifat       [zf.] zarf
    [zm.]  zamir       [bag.] baglac
    [ed.]  edat        [unl.] unlem

Cikti: data/oxford-lists.json
Calistirma: python scripts/extract-oxford.py
"""
import io
import json
import os
import re
import sys
from collections import Counter

from pypdf import PdfReader

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "oxford-lists.json")

FILES = [
    ("A1", "Oxford_Lists_A1.pdf"),
    ("A2", "Oxford_Lists_A2.pdf"),
    ("B1", "Oxford_Lists_B1.pdf"),
    ("B2", "Oxford_Lists_B2.pdf"),
    ("C1", "Oxford_Lists_C1.pdf"),
]

# Turkce dilbilgisi kisaltmasi -> uygulamadaki pos degeri
POS_MAP = {
    "i.": "noun",
    "f.": "verb",
    "s.": "adjective",
    "zf.": "adverb",
    "zm.": "pronoun",
    "bağ.": "conjunction",
    "bag.": "conjunction",
    "ed.": "preposition",
    "ünl.": "interjection",
    "unl.": "interjection",
    "sy.": "number",
    "ünlem": "interjection",
}

def log(msg):
    print(msg, flush=True)


# "anlam [tur]" parcalarini yakalar
SENSE_RE = re.compile(r"([^\[\]]+?)\s*\[([^\]]+)\]")

# Basliklar ve gurultu
SKIP_LINE = re.compile(r"^(Terms\s+Meanings|Page\s+\d+|\d+\s*$)", re.I)


def load_english_vocabulary():
    """
    Bas sozcugu dogrulamak icin 50.000 kelimelik Ingilizce sozcuk kumesi.

    PDF metninde sutun ayraci yok: "about hemen hemen [zf.]" tek satir.
    Bas sozcugun nerede bitip Turkce anlamin nerede basladigini
    ayirt etmek icin Ingilizce sozluge bakmak gerekiyor.
    """
    path = os.path.join(ROOT, "data", "sources", "en_50k.txt")
    vocab = set()
    try:
        with io.open(path, encoding="utf-8") as f:
            for line in f:
                w = line.split(" ")[0].strip()
                if w:
                    vocab.add(w)
    except OSError:
        pass
    return vocab


ENGLISH = load_english_vocabulary()


def load_turkish_vocabulary():
    """
    Turkce sozcuk dagarcigi (Tatoeba Turkce cumlelerinden, ~156.000).

    Neden gerekli: PDF'te uzun bir Turkce anlam alt satira tasindiginda
    o satirin ilk kelimesi bas sozcuk saniliyor. Ornek satir:
        "... elde edilen iceceklerin tumu [i.]"
    Buradan "elde" diye bir "Ingilizce kelime" uretiliyordu. 32 boyle
    kayit vardi (anlatan, kadar, mutfak, vermek, veya...).

    Dosya yoksa filtre devre disi kalir - ayristirma yine calisir.
    """
    path = os.path.join(ROOT, "data", "sources", "tur_sentences.tsv.bz2")
    vocab = set()
    if not os.path.exists(path):
        return vocab
    import bz2 as _bz2
    token = re.compile(r"[a-z\u00e7\u011f\u0131\u00f6\u015f\u00fc]+")
    with _bz2.open(path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            parts = line.split("\t")
            if len(parts) < 3:
                continue
            for t in token.findall(parts[2].lower()):
                vocab.add(t)
    return vocab


TURKISH = load_turkish_vocabulary()

# Turkce korpusunda bulunmayan ama Turkce olan birkac kayit.
TURKISH_EXTRA = {"nitelemek", "temsili"}


def looks_turkish(word):
    """Bas sozcuk aslinda Turkce mi?"""
    w = word.lower()
    # Ingilizce sozlukte varsa Ingilizcedir - "cat", "kilo" gibi ortak
    # yazimli kelimeler yanlislikla elenmesin.
    if w in ENGLISH:
        return False
    if w in TURKISH_EXTRA:
        return True
    # Turkce mastar eki
    if len(w) > 5 and (w.endswith("mek") or w.endswith("mak")):
        return True
    return w in TURKISH


def split_headword(line):
    """
    Satirin basindaki Ingilizce bas sozcugu ayirir.

    Once iki sozcuklu ifade denenir ("look after"), sonra tek sozcuk.
    Ikisi de Ingilizce sozlukte olmali; boylece "about hemen" gibi
    yanlis birlesmeler elenir ("hemen" Ingilizce degil).

    @return (bas_sozcuk, kalan) ya da (None, None)
    """
    parts = line.split()
    if not parts:
        return None, None

    # Iki sozcuklu ifade. Uc kosul birden saglanmali:
    #  - ikinci parca bir edat/parcacik
    #  - birinci parca gercekten ifade kurabilen bir sozcuk
    #  - kalan kisim "[" ile baslamamali (yoksa anlami yutmusuz demektir:
    #    "ten on [i.]" -> kalan "[i.] onluk..." )
    if len(parts) >= 3:
        two = parts[0] + " " + parts[1]
        rest = line[len(two):].strip()
        if (parts[0].lower() in PHRASE_HEADS
                and parts[1].lower() in PHRASE_PARTICLES
                and not rest.startswith("[")):
            return two, rest

    first = parts[0]
    if not re.match(r"^[A-Za-z][A-Za-z'\-]*$", first):
        return None, None
    return first, line[len(first):].strip()


# Obek fiil/ifade ikinci parcasi olabilecek kucuk sozcukler.
PHRASE_PARTICLES = {
    "up", "down", "in", "out", "on", "off", "over", "away", "back",
    "after", "for", "to", "with", "at", "into", "through", "of", "from"
}

# Iki sozcuklu girdinin BIRINCI parcasi olabilecek sozcukler.
#
# Bu liste olmadan Turkce/Ingilizce essesli tuzagina dusuluyordu:
# "ten on [i.] onluk [i.]" satirinda "on" Turkce "10" demek, Ingilizce
# edat degil - ama ikisi de ayni yaziliyor. Sonuc "ten on" diye olmayan
# bir bas sozcuk oluyordu. Ayni sekilde "fourteen on dort sayisi".
#
# Gercek cok sozcuklu girdiler obek fiiller ve kaliplardir; hepsinin
# ilk parcasi asagidaki kumede.
PHRASE_HEADS = {
    "according", "have", "next", "used", "look", "get", "put", "take",
    "come", "go", "turn", "give", "make", "run", "break", "bring",
    "call", "carry", "cut", "fall", "find", "keep", "let", "live",
    "move", "pass", "pay", "pick", "point", "pull", "push", "set",
    "show", "stand", "work", "hold", "check", "grow", "throw", "wake",
    "fill", "clean", "close", "depend", "belong", "consist", "apply"
}


def parse_line(line):
    """
    Bir satiri (kelime, [(anlam, pos), ...]) olarak dondurur.
    Ayristirilamazsa None.
    """
    line = line.strip()
    if not line or SKIP_LINE.match(line):
        return None
    if "[" not in line:
        return None

    term, rest = split_headword(line)
    if not term or not rest:
        return None
    if len(term) > 40:
        return None
    # Satir kaydirma artigi: bas sozcuk aslinda Turkce
    if looks_turkish(term):
        return None

    senses = SENSE_RE.findall(rest)
    if not senses:
        return None

    parsed = []
    for meaning, tag in senses:
        meaning = meaning.strip(" ,;")
        tag = tag.strip().lower()
        if not meaning:
            continue
        parsed.append({"tr": meaning, "pos": POS_MAP.get(tag)})

    return (term, parsed) if parsed else None


def dominant_pos(senses):
    """
    Anlamlar arasinda en cok gecen sozcuk turu.

    Kaynak PDF'te ara sira tur hatasi var: "regain geri kazanmak [i.]
    tekrar ele gecirmek [f.] tekrar kavusmak [f.]" - ilk anlam yanlislikla
    isim isaretli, oysa ucu de fiil. Ilk anlami almak yerine cogunluga
    bakmak bu hatalari eliyor.
    """
    counts = Counter(s["pos"] for s in senses if s["pos"])
    if not counts:
        return None
    top = counts.most_common()
    # Beraberlikte ilk anlamin turu kazanir
    if len(top) > 1 and top[0][1] == top[1][1]:
        for s in senses:
            if s["pos"]:
                return s["pos"]
    return top[0][0]


entries = {}
per_level = {}
unparsed_samples = []
total_lines = 0

for level, filename in FILES:
    path = os.path.join(ROOT, filename)
    if not os.path.exists(path):
        log("ATLANDI (dosya yok): %s" % filename)
        continue

    reader = PdfReader(path)
    count = 0
    for page in reader.pages:
        text = page.extract_text() or ""
        for line in text.split("\n"):
            total_lines += 1
            parsed = parse_line(line)
            if not parsed:
                if line.strip() and not SKIP_LINE.match(line.strip()) and len(unparsed_samples) < 25:
                    unparsed_samples.append("%s: %s" % (level, line.strip()[:90]))
                continue

            term, senses = parsed
            key = term.lower()
            # Ayni kelime birden fazla seviyede gecebilir; EN DUSUK
            # seviye kazanir (once ogrenilen seviye dogru olan).
            if key in entries:
                continue
            entries[key] = {
                "en": term,
                "cefr": level,
                "pos": dominant_pos(senses),
                "senses": senses,
            }
            count += 1

    per_level[level] = count
    log("  %s: %d kelime  (%d sayfa)" % (level, count, len(reader.pages)))

# ---------- Rapor ----------
log("")
log("=== OZET ===")
log("  Toplam kelime : %d" % len(entries))
log("  Turkce sozluk : %d sozcuk (satir kaydirma artiklarini eler)" % len(TURKISH))
log("  Seviyeye gore : %s" % "  ".join("%s:%d" % (k, v) for k, v in per_level.items()))

pos_counter = Counter()
no_pos = 0
for e in entries.values():
    if e["pos"]:
        pos_counter[e["pos"]] += 1
    else:
        no_pos += 1
log("  Sozcuk turu   : %s" % "  ".join("%s:%d" % (k, v) for k, v in pos_counter.most_common()))
log("  Turu okunamayan: %d" % no_pos)

sense_counts = Counter(len(e["senses"]) for e in entries.values())
log("  Anlam sayisi  : %s" % dict(sorted(sense_counts.items())))

if unparsed_samples:
    log("")
    log("  Ayristirilamayan satir ornekleri (%d gosteriliyor):" % len(unparsed_samples))
    for s in unparsed_samples[:12]:
        log("    " + s)

payload = {
    "_source": "Oxford CEFR kelime listeleri (kullanici tarafindan saglandi), Turkce cevirili",
    "_note": "scripts/extract-oxford.py ile ayristirildi. Ayni kelime birden fazla seviyede gecerse en dusuk seviye alinir.",
    "_counts": {"total": len(entries), "byLevel": per_level},
    "words": [entries[k] for k in sorted(entries)],
}

io.open(OUT, "w", encoding="utf-8", newline="\n").write(
    json.dumps(payload, ensure_ascii=False, indent=1)
)
log("")
log("  Yazildi: data/oxford-lists.json (%.0f KB)" % (os.path.getsize(OUT) / 1024))
