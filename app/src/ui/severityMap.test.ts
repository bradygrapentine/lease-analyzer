import { describe, it, expect } from 'vitest';
import {
  overrideToSeverity,
  overridesToPanel,
  severityToOverride,
} from './severityMap';

describe('severityMap', () => {
  it('maps Rule.severity → panel severity', () => {
    expect(severityToOverride('high')).toBe('error');
    expect(severityToOverride('medium')).toBe('warn');
    expect(severityToOverride('low')).toBe('warn');
    expect(severityToOverride('info')).toBe('info');
  });

  it('maps panel severity → Rule.severity (lossy inverse)', () => {
    expect(overrideToSeverity('error')).toBe('high');
    expect(overrideToSeverity('warn')).toBe('medium');
    expect(overrideToSeverity('info')).toBe('info');
  });

  it('bulk-converts an overrides map to panel shape', () => {
    const result = overridesToPanel({
      a: 'high',
      b: 'medium',
      c: 'low',
      d: 'info',
    });
    expect(result).toEqual({
      a: 'error',
      b: 'warn',
      c: 'warn',
      d: 'info',
    });
  });

  it('bulk-convert on empty input returns empty object', () => {
    expect(overridesToPanel({})).toEqual({});
  });
});
