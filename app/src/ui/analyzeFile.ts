import { parseLease } from '../parser/parseLease';
import type { LeaseDocument } from '../parser/types';
import { analyze } from '../rules/analyze';
import { RULE_PACK_V1 } from '../rules/packV1';
import type { Finding, Rule } from '../rules/types';

export interface AnalysisResult {
  doc: LeaseDocument;
  findings: Finding[];
}

export async function analyzeFile(
  bytes: Uint8Array,
  rules: Rule[] = RULE_PACK_V1,
): Promise<AnalysisResult> {
  const doc = await parseLease(bytes);
  const findings = analyze(doc, rules);
  return { doc, findings };
}
