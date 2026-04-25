import { describe, it, expect } from 'vitest';
import { en, enMessages, formatMessage, type MessageKey } from './messages';
import { es } from './locales/es';

describe('i18n messages', () => {
  it('every en key has a non-empty string value', () => {
    for (const [key, value] of Object.entries(enMessages)) {
      expect(typeof value, `${key} should be a string`).toBe('string');
      expect(value.length, `${key} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it('en key set matches the Messages type at runtime', () => {
    // `enMessages` is typed as `Messages` (a Record over MessageKey),
    // so the key set is the source of truth. This guards against an
    // accidental `as` cast hiding a missing key.
    const enKeys = Object.keys(en).sort();
    const baselineKeys = Object.keys(enMessages).sort();
    expect(enKeys).toEqual(baselineKeys);
  });

  it('es stub uses only known message keys', () => {
    const enKeys = new Set<string>(Object.keys(en));
    for (const key of Object.keys(es)) {
      expect(enKeys.has(key), `es has unknown key "${key}"`).toBe(true);
    }
  });

  it('es is intentionally partial — at least one en key is absent (fallback chain matters)', () => {
    const enKeys = Object.keys(en) as MessageKey[];
    const esKeys = new Set<string>(Object.keys(es));
    const missing = enKeys.filter((k) => !esKeys.has(k));
    expect(missing.length).toBeGreaterThan(0);
  });
});

describe('formatMessage', () => {
  it('returns the template unchanged when no params are supplied', () => {
    expect(formatMessage('Hello world')).toBe('Hello world');
  });

  it('substitutes {name} placeholders from params', () => {
    expect(formatMessage('Hello {who}', { who: 'world' })).toBe('Hello world');
  });

  it('coerces numeric params to strings', () => {
    expect(formatMessage('{count} findings', { count: 3 })).toBe('3 findings');
  });

  it('leaves unknown placeholders untouched so typos are visible', () => {
    expect(formatMessage('Hello {who}', { other: 'x' })).toBe('Hello {who}');
  });

  it('substitutes multiple placeholders', () => {
    expect(formatMessage('{a} + {b}', { a: '1', b: '2' })).toBe('1 + 2');
  });
});
