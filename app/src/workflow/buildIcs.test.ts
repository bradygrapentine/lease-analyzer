import { describe, it, expect } from 'vitest';
import { buildIcs } from './buildIcs';

const CRLF = '\r\n';

describe('buildIcs', () => {
  it('produces a well-formed VCALENDAR envelope', () => {
    const ics = buildIcs({
      leaseName: 'Unit 4B lease',
      dates: [{ summary: 'Lease ends', date: '2027-01-15' }],
    });
    const lines = ics.split(CRLF);
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines).toContain('PRODID:-//LeaseGuard//EN');
    expect(lines).toContain('CALSCALE:GREGORIAN');
    expect(lines[lines.length - 2]).toBe('END:VCALENDAR');
    expect(lines[lines.length - 1]).toBe(''); // trailing CRLF
  });

  it('uses CRLF line endings only', () => {
    const ics = buildIcs({
      leaseName: 'L',
      dates: [{ summary: 'x', date: '2027-01-15' }],
    });
    // No bare LF that isn't preceded by CR.
    for (let i = 0; i < ics.length; i++) {
      if (ics[i] === '\n') expect(ics[i - 1]).toBe('\r');
    }
  });

  it('emits one VEVENT per date with all-day DTSTART/DTEND', () => {
    const ics = buildIcs({
      leaseName: 'Lease',
      dates: [
        { summary: 'Notice deadline', date: '2027-01-15' },
        { summary: 'Term ends', date: '2027-02-20' },
      ],
    });
    const events = ics.split(/BEGIN:VEVENT\r\n/).slice(1);
    expect(events).toHaveLength(2);
    expect(ics).toContain('DTSTART;VALUE=DATE:20270115');
    // All-day DTEND is exclusive — next day.
    expect(ics).toContain('DTEND;VALUE=DATE:20270116');
    expect(ics).toContain('DTSTART;VALUE=DATE:20270220');
    expect(ics).toContain('DTEND;VALUE=DATE:20270221');
    expect(ics).toContain('SUMMARY:Notice deadline');
    expect(ics).toContain('SUMMARY:Term ends');
  });

  it('includes stable DTSTAMP and unique UIDs per event', () => {
    const ics = buildIcs({
      leaseName: 'Lease',
      dates: [
        { summary: 'a', date: '2027-01-15' },
        { summary: 'b', date: '2027-02-20' },
      ],
      now: new Date(Date.UTC(2026, 3, 18, 12, 0, 0)),
      uidSeed: 'seed-1',
    });
    const uidLines = ics.split(CRLF).filter((l) => l.startsWith('UID:'));
    expect(uidLines).toHaveLength(2);
    expect(new Set(uidLines).size).toBe(2);
    expect(ics).toContain('DTSTAMP:20260418T120000Z');
    uidLines.forEach((l) => expect(l).toMatch(/@leaseguard\.local$/));
  });

  it('escapes commas, semicolons, backslashes and newlines in text', () => {
    const ics = buildIcs({
      leaseName: 'L',
      dates: [
        {
          summary: 'Due: rent, late fee; see §2',
          date: '2027-01-15',
          notes: 'Line1\nLine2\\end',
        },
      ],
    });
    expect(ics).toContain('SUMMARY:Due: rent\\, late fee\\; see §2');
    // Newline in DESCRIPTION → literal \n escape; backslash doubled.
    expect(ics).toContain('DESCRIPTION:Line1\\nLine2\\\\end');
  });

  it('folds lines longer than 75 octets with CRLF + single space', () => {
    const longNote = 'x'.repeat(200);
    const ics = buildIcs({
      leaseName: 'L',
      dates: [{ summary: 'Y', date: '2027-01-15', notes: longNote }],
    });
    const lines = ics.split(CRLF);
    // Every line must be ≤ 75 octets.
    for (const line of lines) {
      expect(byteLength(line)).toBeLessThanOrEqual(75);
    }
    // Continuation lines start with a single space.
    const descStart = lines.findIndex((l) => l.startsWith('DESCRIPTION:'));
    expect(descStart).toBeGreaterThanOrEqual(0);
    expect(lines[descStart + 1]?.[0]).toBe(' ');
  });

  it('folds correctly with multi-byte UTF-8 characters (byte-measured, not char)', () => {
    // "é" = 2 bytes. Stuff 40 of them into summary (80 bytes).
    const ics = buildIcs({
      leaseName: 'L',
      dates: [{ summary: 'é'.repeat(40), date: '2027-01-15' }],
    });
    for (const line of ics.split(CRLF)) {
      expect(byteLength(line)).toBeLessThanOrEqual(75);
    }
  });

  it('omits DESCRIPTION line when notes are missing', () => {
    const ics = buildIcs({
      leaseName: 'L',
      dates: [{ summary: 's', date: '2027-01-15' }],
    });
    expect(ics).not.toContain('DESCRIPTION:');
  });

  it('throws on an invalid date string', () => {
    expect(() =>
      buildIcs({ leaseName: 'L', dates: [{ summary: 's', date: 'not-a-date' }] }),
    ).toThrow(/YYYY-MM-DD/);
  });

  it('throws when dates array is empty', () => {
    expect(() => buildIcs({ leaseName: 'L', dates: [] })).toThrow(/at least one/);
  });
});

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}
