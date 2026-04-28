import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_MODEL_ID,
  loadClassifier,
  readRuntimeFlag,
  _resetClassifierCacheForTests,
} from './loadClassifier';

afterEach(() => {
  _resetClassifierCacheForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: new URL('http://localhost/'),
  });
});

describe('Phase 18 loadClassifier', () => {
  it('exposes the Wave 18-B-recommended model id as the default', () => {
    expect(DEFAULT_MODEL_ID).toBe('Xenova/paraphrase-MiniLM-L3-v2');
  });

  it('caches the lazy import — second call shares the same promise', () => {
    // Can't actually exercise transformers in jsdom (it pulls ONNX
    // runtime + WebGPU bindings). The contract we DO pin: calling
    // loadClassifier() twice returns the same Promise reference, so
    // the dynamic import only runs once.
    const a = loadClassifier();
    const b = loadClassifier();
    expect(a).toBe(b);
    _resetClassifierCacheForTests();
    const c = loadClassifier();
    expect(c).not.toBe(a);
    a.catch(() => {});
    b.catch(() => {});
    c.catch(() => {});
  });

  it('calling with a custom model id still returns a cached single promise', () => {
    const a = loadClassifier('Xenova/custom-model');
    const b = loadClassifier('Xenova/different-model');
    expect(a).toBe(b);
    a.catch(() => {});
    b.catch(() => {});
  });
});

describe('Wave 36 readRuntimeFlag (v4-default after Part B)', () => {
  it('returns v4 when no flag is present (default after Part B flip)', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('http://localhost/'),
    });
    expect(readRuntimeFlag()).toBe('v4');
  });

  it('returns v2 when the ?transformersV2=on kill switch is set', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('http://localhost/?transformersV2=on'),
    });
    expect(readRuntimeFlag()).toBe('v2');
  });

  it('returns v4 when transformersV2 is set to anything other than "on"', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('http://localhost/?transformersV2=true'),
    });
    expect(readRuntimeFlag()).toBe('v4');
  });

  it('coexists with other URL params (v2 kill switch wins)', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('http://localhost/?phase18=on&transformersV2=on&debug=1'),
    });
    expect(readRuntimeFlag()).toBe('v2');
  });
});
