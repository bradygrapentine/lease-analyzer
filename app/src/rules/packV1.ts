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
    plainEnglish:
      'If you do nothing, the lease continues for another term on its own. Put the notice deadline on your calendar so you have the choice to stay or leave.',
    suggestedEdit:
      'This Lease shall not automatically renew. Upon expiration of the initial term, any continued occupancy shall be on a month-to-month basis, terminable by either party upon thirty (30) days written notice.',
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
    plainEnglish:
      'Ending the lease before its end date costs extra. Read the formula carefully — sometimes the fee is instead of remaining rent, sometimes on top of it.',
    suggestedEdit:
      'Tenant may terminate this Lease prior to expiration upon sixty (60) days written notice and payment of a termination fee equal to one (1) month of then-current base rent. Payment of such fee shall satisfy all further rent obligations under this Lease.',
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
    plainEnglish:
      'You may not be able to hand off the lease to someone else or rent out a room without the landlord saying yes first. Check whether the landlord has to be reasonable about it.',
    suggestedEdit:
      'Tenant may assign this Lease or sublet the premises with the landlord\u2019s prior written consent, which shall not be unreasonably withheld, conditioned, or delayed.',
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
    plainEnglish:
      'Pay rent late and an extra fee is added. Look for a grace period (a few days after the due date with no fee) and a cap on how big the fee can get.',
    suggestedEdit:
      'If rent is not received within five (5) days after the due date, Tenant shall pay a late fee of five percent (5%) of the unpaid amount. Such fee shall be the sole late charge for the applicable period.',
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
    plainEnglish:
      'If there is a legal fight and you lose, you pay the other side\u2019s lawyer bills. Ideally the rule runs both ways so the landlord is on the hook too when they lose.',
    suggestedEdit:
      'In any action or proceeding arising out of this Lease, the prevailing party shall be entitled to recover its reasonable attorneys\u2019 fees and costs from the non-prevailing party.',
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
    plainEnglish:
      'If there is a lawsuit, one judge decides instead of a jury of twelve people. Some tenants prefer to keep the option of a jury, so consider striking this if you can.',
    suggestedEdit:
      'The parties preserve their respective rights to a trial by jury in any action arising out of or related to this Lease.',
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
    plainEnglish:
      'Disagreements get decided by a private arbitrator, not a public court, and you may lose the ability to join others in a class action. Decisions are usually final with little room to appeal.',
    suggestedEdit:
      'Any dispute arising under this Lease may be submitted to non-binding mediation at the election of either party. Neither party shall be required to arbitrate, and each party retains the right to bring claims in a court of competent jurisdiction.',
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
    plainEnglish:
      'You agree to cover the landlord\u2019s costs if someone sues them over something tied to your tenancy. Make sure you are not on the hook when the landlord is the one at fault.',
    suggestedEdit:
      'Tenant shall indemnify Landlord against third-party claims arising out of Tenant\u2019s negligent acts or willful misconduct on the premises. This indemnity shall not extend to claims arising out of the negligence or willful misconduct of Landlord, its employees, or its agents.',
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
    plainEnglish:
      'Rent goes up over time on a set schedule. Check how often, by how much, and whether each year\u2019s increase is applied on top of the prior increase (compounding).',
    suggestedEdit:
      'Base rent shall increase on each anniversary of the commencement date by the lesser of (i) three percent (3%) or (ii) the annual change in the Consumer Price Index. In no event shall any single annual increase exceed five percent (5%).',
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
    plainEnglish:
      'A specific person (often a business owner) promises to pay from their own pocket if the business cannot pay the rent. Personal assets like savings can be at stake.',
    suggestedEdit:
      'Guarantor\u2019s obligations under this Guaranty shall be limited to unpaid rent accruing during the initial term of the Lease and shall not exceed six (6) months of base rent in the aggregate. This Guaranty shall terminate upon expiration of the initial term.',
    match: {
      type: 'regex',
      pattern: '\\bpersonal(?:ly)?\\s+guarant(?:y|ee|or)\\b',
      flags: 'i',
    },
  },
];
