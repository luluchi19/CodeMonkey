export const FREE_MAX_TOKENS_PER_PR = 10000;
export const PRO_MAX_REVIEWS_PER_MONTH = 100;
export const PRO_MAX_TOKENS_PER_MONTH = 500000;

export function getMaxTokensPerPr(tier: "FREE" | "PRO"): number | null {
  if (tier === "PRO") {
    return null;
  }

  return FREE_MAX_TOKENS_PER_PR;
}
