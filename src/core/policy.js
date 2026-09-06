/**
 * Normalization for dynamic interaction policy decisions.
 *
 * An application policy answers `true` (allow), `false` (refuse quietly) or
 * a reason string (refuse with feedback); anything else allows. An empty
 * string refuses without producing a meaningful `data-reason`.
 *
 * @typedef {object} PolicyDecision
 * @property {boolean} ok
 * @property {string | null} reason
 */

/**
 * @param {unknown} result raw application answer
 * @returns {PolicyDecision}
 */
export function normalizePolicyDecision(result) {
  if (result === false) return { ok: false, reason: null };
  if (typeof result === "string") return { ok: false, reason: result || null };
  return { ok: true, reason: null };
}
