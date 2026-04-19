import type { Finding } from '../rules/types';

export interface FindingChange {
  ruleId: string;
  from: Finding;
  to: Finding;
}

export interface FindingsDiff {
  added: Finding[];
  removed: Finding[];
  unchanged: Finding[];
  changed: FindingChange[];
}

export function diffFindings(a: Finding[], b: Finding[]): FindingsDiff {
  const aById = indexByRuleId(a);
  const bById = indexByRuleId(b);

  const added: Finding[] = [];
  const removed: Finding[] = [];
  const unchanged: Finding[] = [];
  const changed: FindingChange[] = [];

  for (const [id, aFinding] of aById) {
    const bFinding = bById.get(id);
    if (!bFinding) {
      removed.push(aFinding);
      continue;
    }
    if (materiallyEqual(aFinding, bFinding)) {
      unchanged.push(bFinding);
    } else {
      changed.push({ ruleId: id, from: aFinding, to: bFinding });
    }
  }

  for (const [id, bFinding] of bById) {
    if (!aById.has(id)) added.push(bFinding);
  }

  return { added, removed, unchanged, changed };
}

function indexByRuleId(findings: Finding[]): Map<string, Finding> {
  const map = new Map<string, Finding>();
  for (const f of findings) {
    if (!map.has(f.ruleId)) map.set(f.ruleId, f);
  }
  return map;
}

function materiallyEqual(a: Finding, b: Finding): boolean {
  return a.severity === b.severity && a.negated === b.negated;
}
