const LETTER_VALUE: Record<string, number> = {
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 34, J: 18, K: 19, L: 20, M: 21,
  N: 22, O: 35, P: 23, Q: 24, R: 25, S: 26, T: 27, U: 28, V: 29, W: 32, X: 30, Y: 31, Z: 33,
};

/** Taiwan National ID / ARC number checksum. */
export function isValidTaiwanId(id: string): boolean {
  if (!/^[A-Z][1289]\d{8}$/.test(id)) return false;
  const n = LETTER_VALUE[id[0]!]!;
  const weights = [8, 7, 6, 5, 4, 3, 2, 1, 1];
  let sum = Math.floor(n / 10) + (n % 10) * 9;
  for (let i = 0; i < 9; i++) sum += Number(id[i + 1]) * weights[i]!;
  return sum % 10 === 0;
}

/** Luhn checksum over a digit-only string. */
export function isValidLuhn(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}
