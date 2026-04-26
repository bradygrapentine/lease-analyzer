import type { BoundingBox, Paragraph } from '../parser/types';
import type { Finding } from '../rules/types';
import { findLinesForSpan } from '../parser/lineSpans';

/**
 * Compute the highlight rectangles for a finding inside a paragraph.
 *
 * Wave 28 Part E — span-level viewer highlighting. When a paragraph carries
 * `lines: LineSpan[]` (Wave 28-A parser output), we project each LineSpan's
 * bbox through the supplied `viewportTransform` so the viewer can render one
 * tight rect per overlapping line. Legacy paragraphs that lack `lines` fall
 * back to the paragraph's own bbox — preserving the pre-Wave-28 contract that
 * the highlight-on-hover Playwright spec depends on.
 */
export function computeSpanRects<TRect = BoundingBox>(
  paragraph: Paragraph,
  finding: Finding,
  viewportTransform: (bbox: BoundingBox) => TRect = (b) => b as unknown as TRect,
): TRect[] {
  if (!paragraph.lines || paragraph.lines.length === 0) {
    return paragraph.bbox ? [viewportTransform(paragraph.bbox)] : [];
  }
  const overlapping = findLinesForSpan(
    paragraph.lines,
    finding.span.start,
    finding.span.end,
  );
  return overlapping.map((line) => viewportTransform(line.bbox));
}
