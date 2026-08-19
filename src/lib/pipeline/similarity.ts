/**
 * Small dependency-free string similarity utility (Sørensen–Dice
 * coefficient over character bigrams). Used by deduplication — good enough
 * for short titles/org names in PT/EN without pulling in an unmaintained
 * npm package for something this small.
 */
function bigrams(input: string): string[] {
  const s = input.toLowerCase().trim();
  if (s.length < 2) return [s];
  const grams: string[] = [];
  for (let i = 0; i < s.length - 1; i++) grams.push(s.slice(i, i + 2));
  return grams;
}

export function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  const mapB = new Map<string, number>();
  for (const g of bigramsB) mapB.set(g, (mapB.get(g) ?? 0) + 1);

  let intersection = 0;
  for (const g of bigramsA) {
    const count = mapB.get(g) ?? 0;
    if (count > 0) {
      intersection++;
      mapB.set(g, count - 1);
    }
  }

  return (2 * intersection) / (bigramsA.length + bigramsB.length);
}

export function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
