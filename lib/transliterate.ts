// A rule-based, best-effort phonetic transliteration from Roman letters to
// Tamil script — good enough to make Tamil-script search work for common
// name patterns, NOT a linguistically perfect transliteration. Consonant
// clusters foreign to Tamil phonotactics (e.g. "pr", "kr") won't always
// come out the way a native speaker would spell them by hand. The Tamil
// name field stays fully editable everywhere this is used, specifically
// so a one-time correction can be made and it'll stick.

const CONSONANTS: Record<string, string> = {
  kh: "க", gh: "க", ng: "ங", ch: "ச", chh: "ச", jh: "ஜ", ny: "ஞ",
  th: "த", dh: "த", ph: "ப", bh: "ப", sh: "ஷ", zh: "ழ",
  k: "க", g: "க", c: "ச", j: "ஜ", t: "ட", d: "ட", n: "ன",
  p: "ப", f: "ஃப", b: "ப", m: "ம", y: "ய", r: "ர", l: "ல",
  v: "வ", w: "வ", s: "ஸ", h: "ஹ", q: "க", x: "க்ஸ", z: "ஸ",
};

const VOWEL_SIGNS: Record<string, string> = {
  aa: "ா", ee: "ீ", oo: "ூ", ai: "ை", au: "ௌ",
  a: "", i: "ி", u: "ு", e: "ெ", o: "ொ",
};

const INDEPENDENT_VOWELS: Record<string, string> = {
  aa: "ஆ", ee: "ஈ", oo: "ஊ", ai: "ஐ", au: "ஔ",
  a: "அ", i: "இ", u: "உ", e: "எ", o: "ஒ",
};

const PULLI = "\u0BCD"; // virama — suppresses a consonant's inherent vowel

function longestMatch(
  text: string,
  pos: number,
  map: Record<string, string>
): { key: string; value: string } | null {
  for (const len of [3, 2, 1]) {
    const chunk = text.slice(pos, pos + len);
    if (chunk.length === len && map[chunk] !== undefined) {
      return { key: chunk, value: map[chunk] };
    }
  }
  return null;
}

function transliterateWord(word: string): string {
  const text = word.toLowerCase();
  let i = 0;
  let out = "";
  let pendingConsonant: string | null = null;

  while (i < text.length) {
    const consonantMatch = longestMatch(text, i, CONSONANTS);
    const vowelMatch = !consonantMatch
      ? longestMatch(text, i, VOWEL_SIGNS)
      : null;

    if (consonantMatch) {
      if (pendingConsonant) out += pendingConsonant + PULLI;
      pendingConsonant = consonantMatch.value;
      i += consonantMatch.key.length;
    } else if (vowelMatch) {
      if (pendingConsonant) {
        out += vowelMatch.key === "a"
          ? pendingConsonant
          : pendingConsonant + VOWEL_SIGNS[vowelMatch.key];
        pendingConsonant = null;
      } else {
        out += INDEPENDENT_VOWELS[vowelMatch.key];
      }
      i += vowelMatch.key.length;
    } else {
      // Unrecognized character (digits, punctuation, etc.) — pass through.
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
