export type TemplateMatchBadge = 'matched' | 'weak' | 'missing';

export function classifyMatch(
  score: number,
  matchedThreshold: number,
  weakThreshold: number,
): TemplateMatchBadge {
  if (score >= matchedThreshold) return 'matched';
  if (score >= weakThreshold) return 'weak';
  return 'missing';
}
