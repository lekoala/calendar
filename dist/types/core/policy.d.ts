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
export type PolicyDecision = {
    ok: boolean;
    reason: string | null;
};
/**
 * @param {unknown} result raw application answer
 * @returns {PolicyDecision}
 */
export declare function normalizePolicyDecision(result: unknown): PolicyDecision;
//# sourceMappingURL=policy.d.ts.map