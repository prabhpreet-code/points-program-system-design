// Seeded RNG so the whole dataset is deterministic.
// mulberry32: small, fast, good-enough distribution for mock data.

export interface Rng {
  next(): number; // [0, 1)
  int(lo: number, hi: number): number; // [lo, hi)
  pick<T>(xs: readonly T[]): T;
  normal(mean?: number, stdev?: number): number;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number): number => lo + Math.floor(next() * (hi - lo));
  const pick = <T>(xs: readonly T[]): T => {
    if (xs.length === 0) throw new Error('pick(): empty array');
    return xs[int(0, xs.length)]!;
  };
  // Box–Muller
  const normal = (mean = 0, stdev = 1): number => {
    const u1 = Math.max(next(), 1e-12);
    const u2 = next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + stdev * z;
  };
  return { next, int, pick, normal };
}
