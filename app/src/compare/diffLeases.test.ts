import { describe, it, expect } from 'vitest';
import { diffLeases } from './diffLeases';
import type { LeaseDocument, Paragraph, Section } from '../parser/types';

function para(text: string, page = 1): Paragraph {
  return { text, page };
}

function section(heading: string, paragraphs: Paragraph[], number: string | null = null): Section {
  return { heading, number, paragraphs, paragraphIndices: [], startPage: paragraphs[0]?.page ?? 1 };
}

function doc(sections: Section[]): LeaseDocument {
  const paragraphs: Paragraph[] = [];
  for (const s of sections) {
    s.paragraphIndices = [];
    for (const p of s.paragraphs) {
      s.paragraphIndices.push(paragraphs.length);
      paragraphs.push(p);
    }
  }
  return { pages: [], paragraphs, sections, raw: paragraphs.map((p) => p.text).join('\n\n') };
}

describe('diffLeases', () => {
  it('reports a matched section whose paragraphs all stayed the same', () => {
    const a = doc([section('Rent', [para('Rent is $1000.')])]);
    const b = doc([section('Rent', [para('Rent is $1000.')])]);
    const result = diffLeases(a, b);
    expect(result.sections).toHaveLength(1);
    const s = result.sections[0]!;
    expect(s.status).toBe('matched');
    expect(s.paragraphs.every((p) => p.status === 'unchanged')).toBe(true);
  });

  it('flags added and removed paragraphs inside a matched section', () => {
    const a = doc([section('Rent', [para('Rent is $1000.')])]);
    const b = doc([section('Rent', [para('Rent is $1000.'), para('Late fee is $50.')])]);
    const result = diffLeases(a, b);
    const s = result.sections[0]!;
    expect(s.status).toBe('matched');
    const statuses = s.paragraphs.map((p) => p.status);
    expect(statuses.filter((x) => x === 'unchanged')).toHaveLength(1);
    expect(statuses.filter((x) => x === 'added')).toHaveLength(1);
  });

  it('marks a section present only in A as removed', () => {
    const a = doc([
      section('Rent', [para('Rent is $1000.')]),
      section('Arbitration', [para('All disputes go to arbitration.')]),
    ]);
    const b = doc([section('Rent', [para('Rent is $1000.')])]);
    const result = diffLeases(a, b);
    const arb = result.sections.find((s) => s.heading === 'Arbitration');
    expect(arb?.status).toBe('removed');
  });

  it('marks a section present only in B as added', () => {
    const a = doc([section('Rent', [para('Rent is $1000.')])]);
    const b = doc([
      section('Rent', [para('Rent is $1000.')]),
      section('Termination', [para('Tenant may terminate with 60 days notice.')]),
    ]);
    const result = diffLeases(a, b);
    const term = result.sections.find((s) => s.heading === 'Termination');
    expect(term?.status).toBe('added');
  });

  it('aligns sections case-insensitively by heading', () => {
    const a = doc([section('RENT', [para('Old rent.')])]);
    const b = doc([section('Rent', [para('New rent.')])]);
    const result = diffLeases(a, b);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.status).toBe('matched');
  });

  it('flags a near-identical paragraph with a numeric change as "changed" instead of add+remove', () => {
    const a = doc([section('Rent', [para('Rent is $1000 per month.')])]);
    const b = doc([section('Rent', [para('Rent is $1200 per month.')])]);
    const result = diffLeases(a, b);
    const statuses = result.sections[0]!.paragraphs.map((p) => p.status);
    expect(statuses).toContain('changed');
    expect(statuses).not.toContain('added');
    expect(statuses).not.toContain('removed');
  });

  it('returns both previous and new text for a "changed" paragraph', () => {
    const a = doc([section('Rent', [para('Rent is $1000.')])]);
    const b = doc([section('Rent', [para('Rent is $1200.')])]);
    const result = diffLeases(a, b);
    const changed = result.sections[0]!.paragraphs.find((p) => p.status === 'changed');
    expect(changed?.text).toBe('Rent is $1200.');
    expect(changed?.previousText).toBe('Rent is $1000.');
  });

  it('still treats very different paragraphs as add+remove', () => {
    const a = doc([section('Rent', [para('Rent is $1000 per month.')])]);
    const b = doc([section('Rent', [para('Tenant shall paint the walls annually.')])]);
    const result = diffLeases(a, b);
    const statuses = result.sections[0]!.paragraphs.map((p) => p.status).sort();
    expect(statuses).toEqual(['added', 'removed']);
  });

  it('flags packVersionMismatch when the two sides were analyzed under different rule pack versions', () => {
    const a = doc([section('Rent', [para('Rent is $1000.')])]);
    const b = doc([section('Rent', [para('Rent is $1200.')])]);
    const result = diffLeases(a, b, { rulePackVersionA: '1.0.0', rulePackVersionB: '1.1.0' });
    expect(result.packVersionMismatch).toEqual({ a: '1.0.0', b: '1.1.0' });
  });

  it('omits packVersionMismatch when both sides share the same rule pack version', () => {
    const a = doc([section('Rent', [para('Rent is $1000.')])]);
    const b = doc([section('Rent', [para('Rent is $1200.')])]);
    const result = diffLeases(a, b, { rulePackVersionA: '1.0.0', rulePackVersionB: '1.0.0' });
    expect(result.packVersionMismatch).toBeUndefined();
  });

  it('omits packVersionMismatch when either version is not supplied', () => {
    const a = doc([section('Rent', [para('Rent is $1000.')])]);
    const b = doc([section('Rent', [para('Rent is $1200.')])]);
    expect(diffLeases(a, b, { rulePackVersionA: '1.0.0' }).packVersionMismatch).toBeUndefined();
    expect(diffLeases(a, b, { rulePackVersionB: '1.0.0' }).packVersionMismatch).toBeUndefined();
    expect(diffLeases(a, b).packVersionMismatch).toBeUndefined();
  });
});
