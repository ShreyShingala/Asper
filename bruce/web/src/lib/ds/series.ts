export type Datum = { label: string; value: number };

// Deterministic sample series (no Math.random: keeps SSR and client output identical).
const lcg = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

export function sampleSeries(n: number, seed: number, min = 10, max = 100, labelPrefix = ""): Datum[] {
  const rnd = lcg(seed);
  return Array.from({ length: n }, (_, i) => ({ label: `${labelPrefix}${i + 1}`, value: Math.round(min + rnd() * (max - min)) }));
}
