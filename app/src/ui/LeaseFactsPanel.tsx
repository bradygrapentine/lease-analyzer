import type {
  CrossReference,
  DefinitionEntry,
  LeaseFacts,
  MoneyValue,
  RentSchedulePeriod,
} from '../facts/types';
import { Section } from './system/Section';

// Aria/data inventory (preserved verbatim):
//   aria-label="lease facts" (section)
//   aria-label="rent schedule" (table)
//   scope="col" (th headers), scope="row" (th row headers)
//   className="visually-hidden" (caption)

interface LeaseFactsPanelProps {
  facts: LeaseFacts;
}

export function LeaseFactsPanel({ facts }: LeaseFactsPanelProps): JSX.Element {
  const rentSchedule = facts.rentSchedule ?? [];
  const isEmpty =
    facts.baseRent === null &&
    facts.securityDeposit === null &&
    facts.termMonths === null &&
    facts.noticePeriodDays === null &&
    facts.commencementDate === null &&
    facts.expirationDate === null &&
    facts.definitions.length === 0 &&
    facts.crossReferences.length === 0 &&
    rentSchedule.length === 0;

  if (isEmpty) {
    return (
      <Section label="lease facts">
        <h3 className="text-heading uppercase text-fg-muted mb-3">Lease facts</h3>
        <p className="text-body text-fg-muted">No structured facts detected in this lease.</p>
      </Section>
    );
  }

  return (
    <Section label="lease facts" className="space-y-4">
      <h3 className="text-heading uppercase text-fg-muted mb-3">Lease facts</h3>
      <table className="w-full text-body text-fg-body">
        <caption className="visually-hidden">Key lease facts</caption>
        <tbody className="divide-y divide-rule">
          <FactRow label="Base rent" value={formatMoney(facts.baseRent)} />
          <FactRow label="Security deposit" value={formatMoney(facts.securityDeposit)} />
          <FactRow label="Term" value={formatMonths(facts.termMonths)} />
          <FactRow label="Notice period" value={formatDays(facts.noticePeriodDays)} />
          <FactRow label="Commencement" value={facts.commencementDate ?? '—'} />
          <FactRow label="Expiration" value={facts.expirationDate ?? '—'} />
        </tbody>
      </table>

      {facts.definitions.length > 0 && (
        <div>
          <h4 className="text-heading uppercase text-fg-muted mb-2">
            Definitions ({facts.definitions.length})
          </h4>
          <dl className="space-y-2">
            {facts.definitions.map((d) => (
              <DefinitionRow key={`${d.term}-${d.paragraphIndex}`} entry={d} />
            ))}
          </dl>
        </div>
      )}

      {facts.crossReferences.length > 0 && (
        <div>
          <h4 className="text-heading uppercase text-fg-muted mb-2">
            Cross-references ({facts.crossReferences.length})
          </h4>
          <ul className="space-y-1 text-body text-fg-body">
            {facts.crossReferences.map((r) => (
              <CrossRefRow key={`${r.target}-${r.paragraphIndex}-${r.page}`} entry={r} />
            ))}
          </ul>
        </div>
      )}

      {rentSchedule.length > 0 && (
        <div>
          <h4 className="text-heading uppercase text-fg-muted mb-2">
            Rent schedule ({rentSchedule.length})
          </h4>
          <table aria-label="rent schedule" className="w-full text-body text-fg-body">
            <thead>
              <tr className="border-b border-rule">
                <th scope="col" className="py-1 pr-3 text-left text-small text-fg-muted font-sans">From</th>
                <th scope="col" className="py-1 pr-3 text-left text-small text-fg-muted font-sans">To</th>
                <th scope="col" className="py-1 pr-3 text-left text-small text-fg-muted font-sans">Amount</th>
                <th scope="col" className="py-1 text-left text-small text-fg-muted font-sans">Escalator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rentSchedule.map((period, i) => (
                <RentScheduleRow key={`${period.from}-${period.to}-${i}`} period={period} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function RentScheduleRow({ period }: { period: RentSchedulePeriod }): JSX.Element {
  return (
    <tr>
      <td className="py-1 pr-3">{period.from}</td>
      <td className="py-1 pr-3">{period.to}</td>
      <td className="py-1 pr-3">{formatAmount(period.amount)}</td>
      <td className="py-1">{period.escalator !== undefined ? `${period.escalator}%` : '—'}</td>
    </tr>
  );
}

function formatAmount(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

interface FactRowProps {
  label: string;
  value: string;
}

function FactRow({ label, value }: FactRowProps): JSX.Element {
  return (
    <tr>
      <th scope="row" className="py-1 pr-4 text-left text-small text-fg-muted font-sans w-40">{label}</th>
      <td className="py-1 text-body text-fg-body font-sans">{value}</td>
    </tr>
  );
}

function DefinitionRow({ entry }: { entry: DefinitionEntry }): JSX.Element {
  return (
    <>
      <dt className="font-sans text-body text-fg-body font-semibold">{entry.term}</dt>
      <dd className="font-sans text-body text-fg-body ml-4">
        {entry.definition} <span className="text-small text-fg-muted">(p. {entry.page})</span>
      </dd>
    </>
  );
}

function CrossRefRow({ entry }: { entry: CrossReference }): JSX.Element {
  return (
    <li>
      <span className="font-sans text-body text-fg-body font-semibold">{entry.text}</span>{' '}
      <span className="text-small text-fg-muted">(p. {entry.page})</span>
    </li>
  );
}

function formatMoney(value: MoneyValue | null): string {
  if (value === null) return '—';
  return `${value.raw} (p. ${value.page})`;
}

function formatMonths(months: number | null): string {
  if (months === null) return '—';
  if (months % 12 === 0) {
    const years = months / 12;
    return `${months} months (${years} ${years === 1 ? 'year' : 'years'})`;
  }
  return `${months} months`;
}

function formatDays(days: number | null): string {
  if (days === null) return '—';
  return `${days} days`;
}
