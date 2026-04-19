import type { LeaseDocument } from '../parser/types';
import type { Finding, Rule } from '../rules/types';
import { handleWorkerRequest } from './handleRequest';
import type { PipelineClient } from './types';

/**
 * Main-thread implementation of `PipelineClient`. Used when no `Worker`
 * constructor is available (jsdom tests) or when a caller explicitly opts
 * out (e.g. a debug toggle). Shares the same parse+analyze pipeline as the
 * worker entry point so behavior is byte-identical.
 */
export function createInlinePipelineClient(): PipelineClient {
  let nextId = 1;
  return {
    async parseAndAnalyze(
      bytes: Uint8Array,
      rules: Rule[],
      rulePackVersion?: string,
    ): Promise<{ doc: LeaseDocument; findings: Finding[] }> {
      const id = nextId++;
      const resp = await handleWorkerRequest({
        id,
        kind: 'parse-analyze',
        bytes,
        rules,
        rulePackVersion,
      });
      if (!resp.ok) throw new Error(resp.error);
      return { doc: resp.doc, findings: resp.findings };
    },
    terminate(): void {
      /* no-op for the inline client — retained for shape parity with the worker-backed client */
    },
  };
}
