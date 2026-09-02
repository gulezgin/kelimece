# -*- coding: utf-8 -*-
"""
Icerik kalite taramasi: Turkce anlamlar ve ornek cumleler.

5276 kaydi gozle okumak guvenilir degil. Bu betik supheli olanlari
isaretliyor, sonra yalnizca onlar elle inceleniyor.

ISABET ODAKLI: 1400 supheli yerine 50 gercek hata bulmak daha iyi.
Ilk surum "Turkce derlemde olmayan her sozcugu" isaretliyordu ve
1373 bulgu uretiyordu; bunlarin cogu yanlis alarmdi cunku Tatoeba
dogal cumlelerden olusuyor ve sozluk anlamlarindaki mastar bicimleri
("sanmak", "konservelemek") dogal metinde neredeyse hic gecmiyor.

Simdiki denetimler dar ama kesin:
  - bitisik yazim   : "herzaman" -> "her" + "zaman" (ikisi de derlemde)
  - yinelenen anlam : "moda, ton, ton, 1000 kg"
  - ingilizce kalinti: "vermek, gave - given"
  - sayi/birim      : anlam alaninda rakam
  - ornek uyumu     : kelime ornek cumlede gercekten geciyor mu

Cikti UTF-8 dosyaya yaziliyor; Windows konsolu Turkce karakterleri
bozuyor.

Calistirma: python scripts/audit-content.py [--out rapor.txt]
"""
import bz2
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, "public", "content", "core-v1.json")

TR_TOKEN = re.compile(u"[a-z\u00e7\u011f\u0131\u00f6\u015f\u00fc]+")
EN_TOKEN = re.compile(r"[a-zA-Z'\-]+")
DIGIT = re.compile(r"[0-9]")


def load_turkish_vocabulary():
    path = os.path.join(ROOT, "data", "sources", "tur_sentences.tsv.bz2")
    vocab = set()
    if not os.path.exists(path):
        sys.stderr.write("UYARI: Turkce derlem yok\n")
        return vocab
    with bz2.open(path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            parts = line.split("\t")
            if len(parts) < 3:
                continue
            for t in TR_TOKEN.findall(parts[2].lower()):
                vocab.add(t)
    return vocab


def split_candidates(token, vocab):
    """
    Bitisik yazilmis iki sozcuk mu?

    "herzaman" -> ("her", "zaman"). Her iki parca da derlemde geciyorsa
    ve parcalar yeterince uzunsa bu neredeyse kesin bir yazim hatasi.
    Kisa parcalara izin vermemek onemli: "kalem" -> "kal"+"em" gibi
    sahte bolunmeleri onluyor.
    """
    for i in range(3, len(token) - 2):
        a, b = token[:i], token[i:]
        if a in vocab and b in vocab:
            return (a, b)
    return None


def audit_meaning(word, vocab):
    issues = []
    en = (word.get("en") or "").strip()
    tr = (word.get("tr") or "").strip()

    if not tr:
        issues.append((u"bos-anlam", u""))
        return issues

    # Yinelenen anlam parcasi: "moda, ton, ton, 1000 kg"
    parts = [p.strip().lower() for p in tr.split(",") if p.strip()]
    seen, dup = set(), []
    for p in parts:
        if p in seen:
            dup.append(p)
        seen.add(p)
    if dup:
        issues.append((u"yinelenen-anlam", u", ".join(dup) + u"   <- " + tr))

    # Ingilizce fiil cekimi kalintisi: "gave - given"
    if re.search(r"\b[a-z]{2,}\s+-\s+[a-z]{2,}\b", tr):
        issues.append((u"ingilizce-kalinti", tr))

    # Anlam alaninda rakam: genelde birim aciklamasi sizmis
    if DIGIT.search(tr):
        issues.append((u"anlamda-rakam", tr))

    # Bitisik yazim
    if vocab:
        for t in TR_TOKEN.findall(tr.lower()):
            if len(t) < 6 or t in vocab:
                continue
            sp = split_candidates(t, vocab)
            if sp:
                issues.append((u"bitisik-yazim", u"%s -> %s %s   <- %s" % (t, sp[0], sp[1], tr)))

    return issues


def surface_forms(word):
    """Kelimenin cumlede gorunebilecek yaygin cekimleri."""
    w = word.lower()
    forms = {w}
    if " " in w:
        return forms
    forms.update({w + "s", w + "es", w + "ed", w + "ing", w + "d", w + "r", w + "st"})
    if w.endswith("e"):
        stem = w[:-1]
        forms.update({stem + "ed", stem + "ing", stem + "es"})
    if w.endswith("y") and len(w) > 2 and w[-2] not in "aeiou":
        stem = w[:-1]
        forms.update({stem + "ies", stem + "ied", stem + "ier", stem + "iest"})
    if len(w) >= 3 and w[-1] not in "aeiouwxy" and w[-2] in "aeiou" and w[-3] not in "aeiou":
        forms.update({w + w[-1] + "ing", w + w[-1] + "ed", w + w[-1] + "er"})
    return forms


def audit_example(word):
    issues = []
    en = (word.get("en") or "").strip()
    ex = (word.get("example") or "").strip()
    ex_tr = (word.get("exampleTr") or "").strip()

    if not ex:
        return issues

    if not ex_tr:
        issues.append((u"ornek-cevirisiz", ex))

    # Tire kelimenin parcasi: "T-shirt" tek belirtec sayilmali
    tokens = {t.lower().strip("'-") for t in EN_TOKEN.findall(ex)}
    if " " in en:
        found = en.lower() in ex.lower()
    else:
        found = bool(tokens & surface_forms(en))
    if not found:
        issues.append((u"kelime-cumlede-yok", en + u"   ||   " + ex))

    n = len(EN_TOKEN.findall(ex))
    if n < 3:
        issues.append((u"ornek-cok-kisa", ex))

    return issues


def main():
    out_path = os.path.join(ROOT, "audit-report.txt")
    if "--out" in sys.argv:
        out_path = sys.argv[sys.argv.index("--out") + 1]

    pack = json.load(io.open(PACK, encoding="utf-8"))
    words = pack["words"]

    sys.stderr.write("Turkce derlem yukleniyor...\n")
    vocab = load_turkish_vocabulary()
    sys.stderr.write("  %d sozcuk\n" % len(vocab))

    buckets = {}
    for w in words:
        for kind, detail in audit_meaning(w, vocab) + audit_example(w):
            rank = w.get("freqRank") or 10 ** 9
            buckets.setdefault(kind, []).append((rank, w["en"], detail))

    total = sum(len(v) for v in buckets.values())
    lines = [u"=== ICERIK TARAMASI: %d kayit, %d bulgu ===" % (len(words), total), u""]
    for kind in sorted(buckets, key=lambda k: -len(buckets[k])):
        rows = sorted(buckets[kind])
        lines.append(u"[%s]  %d" % (kind, len(rows)))
        for rank, en, detail in rows:
            r = u"-" if rank >= 10 ** 9 else str(rank)
            lines.append(u"   #%-6s %-20s %s" % (r, en, detail))
        lines.append(u"")

    io.open(out_path, "w", encoding="utf-8").write(u"\n".join(lines))
    sys.stderr.write("\nYazildi: %s  (%d bulgu)\n" % (out_path, total))
    for kind in sorted(buckets, key=lambda k: -len(buckets[k])):
        sys.stderr.write("  %-22s %d\n" % (kind, len(buckets[kind])))


if __name__ == "__main__":
    main()
