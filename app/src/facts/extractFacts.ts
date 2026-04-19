import { detectTables } from '../parser/tables';
import type { LeaseDocument, Paragraph } from '../parser/types';
import { extractRentSchedule } from './rentSchedule';
import type {
  CrossReference,
  DefinitionEntry,
  LeaseFacts,
  MoneyValue,
} from './types';

const MONEY_RE = /\$(\d[\d,]*(?:\.\d{2})?)/g;
const NEIGHBOR_WINDOW = 60;

interface MoneyHit {
  value: MoneyValue;
  // Lower is better (higher confidence = more specific phrasing).
  priority: number;
}

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

/**
 * Pure, synchronous fact extraction over an already-parsed LeaseDocument.
 * Operates on `doc.paragraphs` only; never re-parses the PDF.
 */
export function extractLeaseFacts(doc: LeaseDocument): LeaseFacts {
  const baseRent = extractBaseRent(doc.paragraphs);
  const securityDeposit = extractSecurityDeposit(doc.paragraphs);
  const termMonths = extractTermMonths(doc.paragraphs);
  const noticePeriodDays = extractNoticePeriodDays(doc.paragraphs);
  const { commencementDate, expirationDate } = extractDates(doc.paragraphs);
  const definitions = extractDefinitions(doc.paragraphs);
  const crossReferences = extractCrossReferences(doc.paragraphs);
  const tables = detectTables(doc.pages);
  const rentSchedule = extractRentSchedule(tables);

  const facts: LeaseFacts = {
    baseRent,
    securityDeposit,
    termMonths,
    noticePeriodDays,
    commencementDate,
    expirationDate,
    definitions,
    crossReferences,
  };
  if (rentSchedule.length > 0) facts.rentSchedule = rentSchedule;
  return facts;
}

// ---------- Money ----------

function extractBaseRent(paragraphs: Paragraph[]): MoneyValue | null {
  return pickBestMoney(paragraphs, (ctx) => {
    const rentIdx = nearestKeywordIndex(ctx, /\brent\b/gi);
    if (rentIdx === -1) return null;
    const depositIdx = nearestKeywordIndex(ctx, /\bdeposit\b/gi);
    // If "deposit" is strictly closer to the $, this $ belongs to deposit, not rent.
    if (depositIdx !== -1 && depositIdx < rentIdx) return null;
    if (/base\s+rent\s+(?:is|of|shall\s+be|equals)/i.test(ctx.neighborhood)) return 0;
    if (/monthly\s+rent\s+(?:is|of|shall\s+be|equals)/i.test(ctx.neighborhood)) return 0;
    if (/rent\s+(?:is|of|shall\s+be|equals)\s+\$/i.test(ctx.neighborhood)) return 1;
    if (/\bmonthly\s+rent\b/i.test(ctx.neighborhood)) return 2;
    if (/\bbase\s+rent\b/i.test(ctx.neighborhood)) return 2;
    return 3;
  });
}

function extractSecurityDeposit(paragraphs: Paragraph[]): MoneyValue | null {
  return pickBestMoney(paragraphs, (ctx) => {
    const depositIdx = nearestKeywordIndex(ctx, /\bdeposit\b/gi);
    if (depositIdx === -1) return null;
    const rentIdx = nearestKeywordIndex(ctx, /\brent\b/gi);
    if (rentIdx !== -1 && rentIdx < depositIdx) return null;
    if (/security\s+deposit\s+(?:is|of|shall\s+be|equals)/i.test(ctx.neighborhood)) return 0;
    if (/\bsecurity\s+deposit\b/i.test(ctx.neighborhood)) return 1;
    return 2;
  });
}

interface MoneyContext {
  neighborhood: string;
  /** Index, inside `neighborhood`, where the `$` match starts. */
  anchor: number;
}

/** Distance (chars) from the `$` anchor to the nearest keyword match, or -1. */
function nearestKeywordIndex(ctx: MoneyContext, re: RegExp): number {
  re.lastIndex = 0;
  let best = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ctx.neighborhood)) !== null) {
    const d = Math.abs(m.index - ctx.anchor);
    if (best === -1 || d < best) best = d;
  }
  return best;
}

/**
 * For every `$...` occurrence, examine the NEIGHBOR_WINDOW chars around the
 * match and ask the classifier which bucket it belongs in (lower = better).
 * This lets us disambiguate rent vs. deposit amounts that appear in the same
 * paragraph — common after paragraph reconstruction collapses adjacent lines.
 */
function pickBestMoney(
  paragraphs: Paragraph[],
  classify: (ctx: MoneyContext) => number | null,
): MoneyValue | null {
  let best: MoneyHit | null = null;
  for (const p of paragraphs) {
    MONEY_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = MONEY_RE.exec(p.text)) !== null) {
      const raw = match[0];
      const numeric = match[1];
      if (numeric === undefined) continue;
      const amount = Number(numeric.replace(/,/g, ''));
      if (!Number.isFinite(amount)) continue;
      const start = Math.max(0, match.index - NEIGHBOR_WINDOW);
      const end = Math.min(p.text.length, match.index + raw.length + NEIGHBOR_WINDOW);
      const neighborhood = p.text.slice(start, end);
      const anchor = match.index - start;
      const priority = classify({ neighborhood, anchor });
      if (priority === null) continue;
      const hit: MoneyHit = {
        value: { amount, currency: 'USD', raw, page: p.page },
        priority,
      };
      if (best === null || hit.priority < best.priority) best = hit;
    }
  }
  return best ? best.value : null;
}

// ---------- Term ----------

function extractTermMonths(paragraphs: Paragraph[]): number | null {
  // Prefer paragraphs that mention "term".
  const withTerm = paragraphs.filter((p) => /\bterm\b/i.test(p.text));
  const pool = withTerm.length > 0 ? withTerm : paragraphs;
  for (const p of pool) {
    const monthMatch = /\b(\d+)[- ]months?\b/i.exec(p.text);
    if (monthMatch && monthMatch[1]) return Number(monthMatch[1]);
    const yearMatch = /\b(\d+)[- ]years?\b/i.exec(p.text);
    if (yearMatch && yearMatch[1]) return Number(yearMatch[1]) * 12;
  }
  return null;
}

// ---------- Notice ----------

function extractNoticePeriodDays(paragraphs: Paragraph[]): number | null {
  const re = /\b(\d+)[- ]days?(?:'|\s)\s*(?:of\s+)?(?:prior\s+)?(?:advance\s+)?(?:written\s+)?notice\b/i;
  // Also allow "X-day notice" via a more permissive shape:
  const reAlt = /\b(\d+)[- ]days?\s+(?:prior\s+)?(?:advance\s+)?(?:written\s+)?notice\b/i;
  for (const p of paragraphs) {
    const m = re.exec(p.text) ?? reAlt.exec(p.text);
    if (m && m[1]) return Number(m[1]);
  }
  return null;
}

// ---------- Dates ----------

interface DateHit {
  iso: string;
  priority: number;
}

function extractDates(paragraphs: Paragraph[]): {
  commencementDate: string | null;
  expirationDate: string | null;
} {
  let commencement: DateHit | null = null;
  let expiration: DateHit | null = null;

  for (const p of paragraphs) {
    const text = p.text;
    const lower = text.toLowerCase();
    const dates = findDatesInText(text);
    if (dates.length === 0) continue;

    const isCommence = /\bcommenc/i.test(text) || lower.includes('begin') || lower.includes('start');
    const isExpire =
      /\bexpir/i.test(text) ||
      lower.includes('terminate') ||
      lower.includes('end of the term') ||
      lower.includes('end on');
    const isTerm = /\bterm\b/i.test(text);

    const priority = isCommence || isExpire ? 0 : isTerm ? 1 : 2;

    if (isCommence) {
      const iso = dates[0];
      if (iso && (commencement === null || priority < commencement.priority)) {
        commencement = { iso, priority };
      }
    }
    if (isExpire) {
      const iso = dates[dates.length - 1];
      if (iso && (expiration === null || priority < expiration.priority)) {
        expiration = { iso, priority };
      }
    }
    if (!isCommence && !isExpire && isTerm && dates.length >= 2) {
      // Fallback: "The term runs from X to Y."
      const first = dates[0];
      const last = dates[dates.length - 1];
      if (first && (commencement === null || priority < commencement.priority)) {
        commencement = { iso: first, priority };
      }
      if (last && (expiration === null || priority < expiration.priority)) {
        expiration = { iso: last, priority };
      }
    }
  }

  return {
    commencementDate: commencement?.iso ?? null,
    expirationDate: expiration?.iso ?? null,
  };
}

function findDatesInText(text: string): string[] {
  const out: string[] = [];
  // ISO first: 2026-01-01
  const isoRe = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = isoRe.exec(text)) !== null) {
    if (m[1] && m[2] && m[3]) {
      const iso = toIso(Number(m[1]), Number(m[2]), Number(m[3]));
      if (iso) out.push(iso);
    }
  }
  // Slash: 1/1/2026 or 01/01/2026 (treated as M/D/YYYY)
  const slashRe = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
  while ((m = slashRe.exec(text)) !== null) {
    if (m[1] && m[2] && m[3]) {
      const iso = toIso(Number(m[3]), Number(m[1]), Number(m[2]));
      if (iso) out.push(iso);
    }
  }
  // Month name: "January 1, 2026" or "January 1 2026"
  const monthRe = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi;
  while ((m = monthRe.exec(text)) !== null) {
    if (m[1] && m[2] && m[3]) {
      const month = MONTHS[m[1].toLowerCase()];
      if (month) {
        const iso = toIso(Number(m[3]), month, Number(m[2]));
        if (iso) out.push(iso);
      }
    }
  }
  return out;
}

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1000 || year > 9999) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

// ---------- Definitions ----------

const QUOTED_DEF_RE = /"([^"]+)"\s+(?:shall\s+mean|means)\s+([^.]+)\./gi;
const CAPPED_DEF_RE = /\b([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*)*)\s+means\s+([^.]+)\./g;

function extractDefinitions(paragraphs: Paragraph[]): DefinitionEntry[] {
  const out: DefinitionEntry[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (!p) continue;
    let m: RegExpExecArray | null;
    QUOTED_DEF_RE.lastIndex = 0;
    while ((m = QUOTED_DEF_RE.exec(p.text)) !== null) {
      const term = m[1]?.trim();
      const definition = m[2]?.trim();
      if (!term || !definition) continue;
      const key = term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ term, definition, page: p.page, paragraphIndex: i });
    }
    CAPPED_DEF_RE.lastIndex = 0;
    while ((m = CAPPED_DEF_RE.exec(p.text)) !== null) {
      const term = m[1]?.trim();
      const definition = m[2]?.trim();
      if (!term || !definition) continue;
      const key = term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ term, definition, page: p.page, paragraphIndex: i });
    }
  }
  return out;
}

// ---------- Cross-references ----------

const SECTION_RE = /\bSection\s+\d+(?:\.\d+)*\b/g;
const EXHIBIT_RE = /\bExhibit\s+[A-Z]\b/g;
const SCHEDULE_RE = /\bSchedule\s+\d+\b/g;

function extractCrossReferences(paragraphs: Paragraph[]): CrossReference[] {
  const out: CrossReference[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (!p) continue;
    for (const [re, kind] of [
      [SECTION_RE, 'section'] as const,
      [EXHIBIT_RE, 'exhibit'] as const,
      [SCHEDULE_RE, 'schedule'] as const,
    ]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(p.text)) !== null) {
        const text = m[0];
        const target = `${kind}:${text.replace(/\s+/g, ' ').trim()}`;
        out.push({ text, target, page: p.page, paragraphIndex: i });
      }
    }
  }
  return out;
}
