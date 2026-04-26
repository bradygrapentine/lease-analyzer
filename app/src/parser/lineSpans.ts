import type { LineSpan } from './types';

/**
 * Return the lines whose char range [start,end) overlaps the given span [spanStart,spanEnd).
 * Both endpoints treated as exclusive on the right. Result preserves input order.
 *
 * Used by Part E (span-level viewer highlighting): given a finding's char offsets
 * within a Paragraph.text, locate the LineSpans whose bboxes should be highlighted.
 */
export function findLinesForSpan(
  lines: LineSpan[],
  spanStart: number,
  spanEnd: number,
): LineSpan[] {
  if (spanEnd <= spanStart) return [];
  return lines.filter((line) => line.start < spanEnd && line.end > spanStart);
}
