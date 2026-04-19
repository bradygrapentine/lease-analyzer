import { describe, it, expect } from 'vitest';
import { diffLeases } from './diffLeases';
import type { LeaseDocument, Paragraph, Section } from '../parser/types';

function para(text: string, page = 1): Paragraph {
  return { text, page };
}

function section(heading: string, paragraphs: Paragraph[], number: string | null = null): Section {
  return { heading, number, paragraphs, startPage: paragraphs[0]?.page ?? 1 };
}

function doc(sections: Section[]): LeaseDocument {
  const paragraphs = sections.flatMap((s) => s.paragraphs);
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
});
