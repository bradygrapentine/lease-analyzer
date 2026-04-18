import { parseLease } from '../parser/parseLease';
import type { LeaseDocument } from '../parser/types';
import { analyze } from '../rules/analyze';
import { RULE_PACK_V1 } from '../rules/packV1';
import type { Finding } from '../rules/types';

export interface AnalysisResult {
  doc: LeaseDocument;
  findings: Finding[];
}

export async function analyzeFile(bytes: Uint8Array): Promise<AnalysisResult> {
  const doc = await parseLease(bytes);
  const findings = analyze(doc, RULE_PACK_V1);
  return { doc, findings };
}
