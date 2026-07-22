// A rule-based, best-effort phonetic transliteration from Roman letters to
// Tamil script. It is tuned against real Tamil name spellings but remains an
// approximation — the Tamil name field stays editable everywhere so any
// residual mismatch can be corrected once and it sticks.
//
// Key rules encoded (learned from real examples):
//  - Barbar   -> பார்பர்   (bar = long பா + ர்)
//  - Venkatesh-> வெங்கடேஷ் (n->ங் before k; te = டே long e; retroflex ட)
//  - Natraj   -> நடராஜ்    (initial n->ந; tr->டர; raj = long ரா)
//  - Saranya  -> சரண்யா    (s->ச; n->ண் before y; final a->ஆ)

const NGA = "ங"; // velar nasal (before k/g)
const NYA = "ஞ"; // palatal nasal (before ch/j)
const RETRO_N = "ண"; // retroflex nasal (before retroflex / y clusters)
const DENTAL_N = "ந"; // dental nasal (word-initial, before dentals)
const ALVEO_N = "ன"; // alveolar nasal (default, mid/final)

const RETRO_T = "ட"; // retroflex t/d
const DENTAL_T = "த"; // dental t/d

const VOWEL_SIGNS: Record<string, string> = {
  aa: "ா", ii: "ீ", uu: "ூ", ee: "ீ", oo: "ூ", ai: "ை", au: "ௌ",
  a: "", i: "ி", u: "ு", e: "ெ", o: "ொ",
  E: "ே", A: "ா",
};

const INDEPENDENT_VOWELS: Record<string, string> = {
  aa: "ஆ", ii: "ஈ", uu: "ஊ", ee: "ஈ", oo: "ஊ", ai: "ஐ", au: "ஔ",
  a: "அ", i: "இ", u: "உ", e: "எ", o: "ஒ",
  E: "ஏ", A: "ஆ",
};

// Base consonant sounds (matched greedily, longest key first).
const CONSONANTS: Record<string, string> = {
  ksh: "க்ஷ", shh: "ஷ",
  kh: "க", gh: "க", ng: NGA, ch: "ச", chh: "ச", jh: "ஜ",   th: DENTAL_T, dh: DENTAL_T, ph: "ப", bh: "ப", sh: "ஷ", zh: "ழ",
  tt: RETRO_T, dd: RETRO_T, rr: "ற",
  k: "க", g: "க", c: "க", j: "ஜ",
  t: DENTAL_T, d: DENTAL_T,
  n: ALVEO_N, p: "ப", f: "ஃப", b: "ப", m: "ம", y: "ய", r: "ர",
  l: "ல", v: "வ", w: "வ",
  // "s" defaults to ச (Saranya -> சரண்யா, Suresh -> சுரேஷ்), which is how
  // most Tamil given names are actually written, rather than ஸ.
  s: "ச", h: "ஹ", q: "க", x: "க்ஸ", z: "ஜ",
};

const PULLI = "\u0BCD"; // virama — suppresses a consonant's inherent vowel

const CONSONANT_KEYS = Object.keys(CONSONANTS).sort(
  (a, b) => b.length - a.length
);
const VOWEL_KEYS = Object.keys(VOWEL_SIGNS).sort((a, b) => b.length - a.length);

function longestMatch(
  text: string,
  pos: number,
  keys: string[],
  map: Record<string, string>
): { key: string; value: string } | null {
  for (const key of keys) {
    if (text.startsWith(key, pos)) {
      return { key, value: map[key] };
    }
  }
  return null;
}

// Which nasal glyph an "n" should be, based on what follows.
function resolveN(text: string, i: number): string {
  const rest = text.slice(i + 1);
  if (/^(k|g)/.test(rest)) return NGA; // Venkatesh -> வெங்க
  if (/^(ch|j)/.test(rest)) return NYA;
  if (/^(th|dh)/.test(rest)) return DENTAL_N;
  if (/^(t|d)/.test(rest)) return RETRO_N; // before retroflex t/d
  if (/^y/.test(rest)) return RETRO_N; // Saranya -> சரண்ய
  if (i === 0) return DENTAL_N; // Natraj, Naveen -> ந
  return ALVEO_N;
}

// Tamil name romanization routinely drops long-vowel marks; restore the two
// most common cases: a stressed first syllable like Bar->பார், and word-final
// "-a" endings (Saranya, Priya, Latha).
function shouldLengthenA(
  text: string,
  vowelPos: number,
  afterConsonant: boolean
): boolean {
  const atWordEnd = vowelPos + 1 === text.length;
  if (atWordEnd) return true;
  if (afterConsonant && vowelPos <= 2) {
    const after = text.slice(vowelPos + 1);
    // "bar", "nar", "kal": a + single liquid/nasal + a following (lowercase)
    // consonant or end. Excludes the private markers E/A and vowels so it
    // stays conservative (Ramesh, Barbar's 2nd syllable stay short).
    if (/^([rlmn])(?!\1)([bcdfghjklmnpqrstvwxyz]|$)/.test(after)) return true;
  }
  return false;
}

// Common name-syllable long-vowel restorations done as a cheap text
// pre-pass, since these are hard to infer purely char-by-char:
//   -esh$  -> -eesh  (Ramesh, Suresh, Venkatesh -> ...ரேஷ், not ...ரெஷ்)
//   -osh$  -> -oosh
//   medial "raj"/"ram"/"raन" style long "aa" is left to shouldLengthenA.
function restoreLongVowels(word: string): string {
  let w = word;
  // "-esh"/"-ej" endings carry the long-e ஏ (Ramesh, Suresh, Venkatesh).
  w = w.replace(/e(sh)$/i, "E$1");
  w = w.replace(/e(j)$/i, "E$1");
  // Whole-word "...umar"/"...amar" pattern: the "a" before final "r" is long
  // (Kumar -> குமார்). Kept deliberately narrow (must be the 2nd-to-last
  // char, preceded by a consonant+vowel) so it doesn't fire on Barbar/Ramesh.
  if (/^[a-z]{1,3}[aeiou][a-z]ar$/i.test(w)) {
    w = w.replace(/a(r)$/i, "A$1");
  }
  return w;
}

function transliterateWord(rawWord: string): string {
  const text = restoreLongVowels(rawWord.toLowerCase());
  let i = 0;
  let out = "";
  let pendingConsonant: string | null = null;

  while (i < text.length) {
    const consonantMatch = longestMatch(text, i, CONSONANT_KEYS, CONSONANTS);
    const vowelMatch = !consonantMatch
      ? longestMatch(text, i, VOWEL_KEYS, VOWEL_SIGNS)
      : null;

    if (consonantMatch) {
      if (pendingConsonant) out += pendingConsonant + PULLI;
      let value = consonantMatch.value;
      if (consonantMatch.key === "n") value = resolveN(text, i);
      pendingConsonant = value;
      i += consonantMatch.key.length;
    } else if (vowelMatch) {
      let vowelKey = vowelMatch.key;
      if (
        vowelKey === "a" &&
        shouldLengthenA(text, i, pendingConsonant !== null)
      ) {
        vowelKey = "aa";
      }

      if (pendingConsonant) {
        out +=
          vowelKey === "a"
            ? pendingConsonant
            : pendingConsonant + VOWEL_SIGNS[vowelKey];
        pendingConsonant = null;
      } else {
        out += INDEPENDENT_VOWELS[vowelKey];
      }
      i += vowelMatch.key.length;
    } else {
      if (pendingConsonant) {
        out += pendingConsonant + PULLI;
        pendingConsonant = null;
      }
      out += text[i];
      i += 1;
    }
  }

  if (pendingConsonant) out += pendingConsonant + PULLI;
  return out;
}

export function transliterateToTamil(name: string): string {
  return name
    .split(" ")
    .map((word) => (word ? transliterateWord(word) : word))
    .join(" ");
}
