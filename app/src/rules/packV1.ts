import type { Rule } from './types';

export const RULE_PACK_V1: Rule[] = [
  {
    id: 'auto-renewal',
    severity: 'medium',
    category: 'termination',
    title: 'Auto-renewal clause',
    explanation:
      'Lease renews automatically unless you send written notice by a deadline. Calendar the notice date.',
    citation: null,
    match: {
      type: 'regex',
      pattern: '\\bauto(?:matic(?:ally)?)?[- ]?renew(?:al|s|ed)?\\b',
      flags: 'i',
    },
  },
  {
    id: 'early-termination-fee',
    severity: 'high',
    category: 'termination',
    title: 'Early termination fee',
    explanation:
      'Charges if you break the lease early. Check how the fee is calculated and whether it replaces or stacks with rent owed.',
    citation: null,
    match: {
      type: 'keywordProximity',
      keywords: ['early', 'termination'],
      window: 40,
    },
  },
  {
    id: 'assignment-subletting',
    severity: 'medium',
    category: 'obligations',
    title: 'Assignment / subletting restriction',
    explanation:
      'Limits your ability to transfer the lease or sublet. Look for landlord consent requirements.',
    citation: null,
    match: {
      type: 'keywordProximity',
      keywords: ['sublet', 'consent'],
      window: 60,
    },
  },
  {
    id: 'late-fees',
    severity: 'medium',
    category: 'fees',
    title: 'Late fee',
    explanation: 'Fee for rent paid after the due date. Check cap and grace period.',
    citation: null,
    match: {
      type: 'regex',
      pattern: '\\blate\\s+(?:fee|charge|payment)s?\\b',
      flags: 'i',
    },
  },
  {
    id: 'attorney-fees',
    severity: 'medium',
    category: 'dispute',
    title: 'Attorney fees',
    explanation:
      'Loser of any dispute must pay the other side\u2019s legal bills. Consider mutual vs. one-way language.',
    citation: null,
    match: {
      type: 'keywordProximity',
      keywords: ['attorney', 'fees'],
      window: 40,
    },
  },
  {
    id: 'jury-waiver',
    severity: 'high',
    category: 'dispute',
    title: 'Waiver of jury trial',
    explanation: 'You give up the right to a jury; a judge decides any lawsuit.',
    citation: null,
    match: {
      type: 'keywordProximity',
      keywords: ['waive', 'jury'],
      window: 40,
    },
  },
  {
    id: 'arbitration',
    severity: 'high',
    category: 'dispute',
    title: 'Mandatory arbitration',
    explanation:
      'Disputes go to a private arbitrator instead of court. Often waives class actions.',
    citation: null,
    match: {
      type: 'regex',
      pattern: '\\b(?:binding\\s+)?arbitration\\b',
      flags: 'i',
    },
  },
  {
    id: 'indemnification',
    severity: 'high',
    category: 'liability',
    title: 'Indemnification of landlord',
    explanation:
      'You must cover the landlord\u2019s losses from claims, often broadly. Check for carve-outs for landlord negligence.',
    citation: null,
    match: {
      type: 'keywordProximity',
      keywords: ['indemnify', 'landlord'],
      window: 60,
    },
  },
  {
    id: 'rent-escalation',
    severity: 'medium',
    category: 'finance',
    title: 'Rent escalation',
    explanation:
      'Rent increases on a schedule or index. Check the cap, frequency, and whether it compounds.',
    citation: null,
    match: {
      type: 'keywordProximity',
      keywords: ['rent', 'increase'],
      window: 40,
    },
  },
  {
    id: 'personal-guaranty',
    severity: 'high',
    category: 'liability',
    title: 'Personal guaranty',
    explanation:
      'Someone is personally on the hook for lease obligations beyond the business entity.',
    citation: null,
    match: {
      type: 'regex',
      pattern: '\\bpersonal(?:ly)?\\s+guarant(?:y|ee|or)\\b',
      flags: 'i',
    },
  },
];
