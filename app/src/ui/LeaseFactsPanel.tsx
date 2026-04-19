import type {
  CrossReference,
  DefinitionEntry,
  LeaseFacts,
  MoneyValue,
  RentSchedulePeriod,
} from '../facts/types';

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
      <section aria-label="lease facts">
        <h2>Lease facts</h2>
        <p>No structured facts detected in this lease.</p>
      </section>
    );
  }

  return (
    <section aria-label="lease facts">
      <h2>Lease facts</h2>
      <table>
        <caption className="visually-hidden">Key lease facts</caption>
        <tbody>
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
          <h3>Definitions ({facts.definitions.length})</h3>
          <dl>
            {facts.definitions.map((d) => (
              <DefinitionRow key={`${d.term}-${d.paragraphIndex}`} entry={d} />
            ))}
          </dl>
        </div>
      )}

      {facts.crossReferences.length > 0 && (
        <div>
          <h3>Cross-references ({facts.crossReferences.length})</h3>
          <ul>
            {facts.crossReferences.map((r) => (
              <CrossRefRow key={`${r.target}-${r.paragraphIndex}-${r.page}`} entry={r} />
            ))}
          </ul>
        </div>
      )}

      {rentSchedule.length > 0 && (
        <div>
          <h3>Rent schedule ({rentSchedule.length})</h3>
          <table aria-label="rent schedule">
            <thead>
              <tr>
                <th scope="col">From</th>
                <th scope="col">To</th>
                <th scope="col">Amount</th>
                <th scope="col">Escalator</th>
              </tr>
            </thead>
            <tbody>
              {rentSchedule.map((period, i) => (
                <RentScheduleRow key={`${period.from}-${period.to}-${i}`} period={period} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RentScheduleRow({ period }: { period: RentSchedulePeriod }): JSX.Element {
  return (
    <tr>
      <td>{period.from}</td>
      <td>{period.to}</td>
      <td>{formatAmount(period.amount)}</td>
      <td>{period.escalator !== undefined ? `${period.escalator}%` : '—'}</td>
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
      <th scope="row">{label}</th>
      <td>{value}</td>
    </tr>
  );
}

function DefinitionRow({ entry }: { entry: DefinitionEntry }): JSX.Element {
  return (
    <>
      <dt>{entry.term}</dt>
      <dd>
        {entry.definition} <small>(p. {entry.page})</small>
      </dd>
    </>
  );
}

function CrossRefRow({ entry }: { entry: CrossReference }): JSX.Element {
  return (
    <li>
      <strong>{entry.text}</strong> <small>(p. {entry.page})</small>
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
