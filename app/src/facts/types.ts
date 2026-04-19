export interface MoneyValue {
  amount: number;
  currency: string;
  raw: string;
  page: number;
}

export interface DefinitionEntry {
  term: string;
  definition: string;
  page: number;
  paragraphIndex: number;
}

export interface CrossReference {
  text: string;
  target: string;
  page: number;
  paragraphIndex: number;
}

export interface RentSchedulePeriod {
  from: string; // ISO YYYY-MM-DD
  to: string; // ISO YYYY-MM-DD
  amount: number;
  /** Percent escalator, e.g. 3 for "3%". Optional. */
  escalator?: number;
}

export interface LeaseFacts {
  baseRent: MoneyValue | null;
  securityDeposit: MoneyValue | null;
  termMonths: number | null;
  noticePeriodDays: number | null;
  commencementDate: string | null; // ISO YYYY-MM-DD
  expirationDate: string | null; // ISO YYYY-MM-DD
  definitions: DefinitionEntry[];
  crossReferences: CrossReference[];
  /**
   * Optional: populated when a rent-schedule table is detected in the
   * document. Absent when there's nothing table-like to parse.
   */
  rentSchedule?: RentSchedulePeriod[];
}
