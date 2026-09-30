// frontend-architecture/src/features/schedule/lib/normal-cdf.ts
// PSI-119 · Φ(z) for the PERT probability question, with no dependency.
// cpm-evm.md → PSI-119: "probability = Φ(z) (Abramowitz–Stegun erf, |error| < 1.5e-7)".
//
// Abramowitz & Stegun 7.1.26, the five-term rational approximation of erf with maximum absolute
// error 1.5e-7. That is two orders of magnitude tighter than the 1e-3 the fixture is asserted at,
// so it never moves a displayed probability.

const P = 0.3275911;
const A1 = 0.254829592;
const A2 = -0.284496736;
const A3 = 1.421413741;
const A4 = -1.453152027;
const A5 = 1.061405429;

/** erf(x) for any real x, via A&S 7.1.26 (odd function, so reuse the positive branch). */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + P * ax);
  const poly = ((((A5 * t + A4) * t + A3) * t + A2) * t + A1) * t;
  return sign * (1 - poly * Math.exp(-ax * ax));
}

/** The standard normal CDF, clamped to [0, 1] so a saturated tail cannot return 1.0000000002. */
export function normalCdf(z: number): number {
  const phi = 0.5 * (1 + erf(z / Math.SQRT2));
  return phi < 0 ? 0 : phi > 1 ? 1 : phi;
}
