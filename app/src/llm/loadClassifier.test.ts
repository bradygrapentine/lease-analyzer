import { afterEach, describe, it, expect, vi } from 'vitest';
import { DEFAULT_MODEL_ID, loadClassifier, _resetClassifierCacheForTests } from './loadClassifier';

afterEach(() => {
  _resetClassifierCacheForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Phase 18 loadClassifier (stub)', () => {
  it('exposes the Wave 18-B-recommended model id as the default', () => {
    expect(DEFAULT_MODEL_ID).toBe('Xenova/paraphrase-MiniLM-L3-v2');
  });

  it('caches the lazy import — second call shares the same promise', () => {
    // We can't actually exercise @xenova/transformers in jsdom (it pulls
    // ONNX runtime + WebGPU bindings). The contract we DO pin: calling
    // loadClassifier() twice returns the same Promise reference, so the
    // dynamic import only runs once.
    const a = loadClassifier();
    const b = loadClassifier();
    expect(a).toBe(b);
    // Reset; new call gets a fresh promise.
    _resetClassifierCacheForTests();
    const c = loadClassifier();
    expect(c).not.toBe(a);
    // Suppress unhandled rejections — these promises will fail under
    // jsdom because @xenova/transformers can't load without WebGPU.
    a.catch(() => {});
    b.catch(() => {});
    c.catch(() => {});
  });

  it('calling with a custom model id still returns a cached single promise', () => {
    const a = loadClassifier('Xenova/custom-model');
    const b = loadClassifier('Xenova/different-model');
    // Cache is keyed only by "has it been called yet?" — first id wins
    // until reset. Wave 21+ may revisit if multiple-models-at-once is a
    // real use case.
    expect(a).toBe(b);
    a.catch(() => {});
    b.catch(() => {});
  });
});
