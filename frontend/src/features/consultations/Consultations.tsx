import { MapPin, Search, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  DialogPanel,
  EmptyState,
  Notice,
  PageHeading,
  Panel,
} from '../../components/ui';
import {
  COMPARE_LIMIT,
  CONSULTATION_OPTIONS,
  CONSULTATION_SPECIALTIES,
  EMPTY_FILTERS,
  feeLabel,
  filterConsultations,
  toggleCompare,
  type ConsultationFilters,
  type ConsultationOption,
  type FeeFilter,
} from '../../data/mock/consultations';

const FEE_FILTERS: FeeFilter[] = ['Any', 'Free (illustrative)', 'Up to ₹300', 'Fee not listed'];
const COMPARE_ROWS: { label: string; value: (o: ConsultationOption) => string }[] = [
  { label: 'Specialty', value: (o) => o.specialty },
  { label: 'Provider type', value: (o) => o.providerType },
  { label: 'Mode', value: (o) => o.modes.join(', ') },
  { label: 'Location', value: (o) => o.area },
  { label: 'Fee', value: (o) => feeLabel(o.fee) },
  { label: 'Languages', value: (o) => o.languages.join(', ') },
  { label: 'Hours', value: (o) => o.hours },
];

export function Consultations() {
  const [filters, setFilters] = useState<ConsultationFilters>(EMPTY_FILTERS);
  const searchInput = useRef<HTMLInputElement>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [detail, setDetail] = useState<ConsultationOption | null>(null);
  const [message, setMessage] = useState('');
  const results = useMemo(() => filterConsultations(CONSULTATION_OPTIONS, filters), [filters]);
  const compared = compare
    .map((id) => CONSULTATION_OPTIONS.find((o) => o.id === id))
    .filter((o): o is ConsultationOption => Boolean(o));
  const filtered = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  function set<K extends keyof ConsultationFilters>(key: K, value: ConsultationFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }
  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    searchInput.current?.focus();
  }
  function showDetail(option: ConsultationOption | null) {
    setDetail(option);
    setMessage('');
  }
  function toggle(id: string) {
    const next = toggleCompare(compare, id);
    if (next === compare)
      setMessage(`You can compare up to ${COMPARE_LIMIT} options. Remove one to add another.`);
    else setMessage('');
    setCompare(next);
  }
  return (
    <>
      <PageHeading
        eyebrow="Patient · Consultations"
        title="Find and compare consultations"
        description="Search a fictional directory and compare up to three options. Providers, places and fees are invented, and nothing here can be booked."
      />
      <div className="consult-layout">
        <Panel
          title="Fictional directory"
          description={`${results.length} of ${CONSULTATION_OPTIONS.length} sample options`}
        >
          <div className="consult-filters">
            <label className="search-field">
              <span className="sr-only">Search consultations</span>
              <Search size={16} />
              <input
                ref={searchInput}
                type="search"
                placeholder="Search name, specialty or area"
                value={filters.query}
                onChange={(e) => set('query', e.target.value)}
                autoComplete="off"
                maxLength={60}
              />
            </label>
            <label className="consult-filter">
              <span>Specialty</span>
              <select value={filters.specialty} onChange={(e) => set('specialty', e.target.value)}>
                <option>All specialties</option>
                {CONSULTATION_SPECIALTIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="consult-filter">
              <span>Mode</span>
              <select value={filters.mode} onChange={(e) => set('mode', e.target.value)}>
                <option>All modes</option>
                <option>In person</option>
                <option>Video</option>
                <option>Phone</option>
              </select>
            </label>
            <label className="consult-filter">
              <span>Fee</span>
              <select value={filters.fee} onChange={(e) => set('fee', e.target.value as FeeFilter)}>
                {FEE_FILTERS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            {filtered && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
          {results.length ? (
            <ul className="consult-list" aria-label="Sample consultation options">
              {results.map((o) => {
                const selected = compare.includes(o.id);
                return (
                  <li key={o.id} className={selected ? 'selected' : undefined}>
                    <div className="consult-main">
                      <strong>{o.name}</strong>
                      <span>
                        {o.specialty} · {o.providerType}
                      </span>
                      <span className="consult-area">
                        <MapPin size={14} />
                        {o.area}
                      </span>
                    </div>
                    <div className="consult-meta">
                      <span className="consult-fee">{feeLabel(o.fee)}</span>
                      <span className="consult-modes">{o.modes.join(' · ')}</span>
                    </div>
                    <div className="consult-actions">
                      <Button variant="ghost" size="sm" onClick={() => showDetail(o)}>
                        Details
                      </Button>
                      <Button
                        variant={selected ? 'primary' : 'secondary'}
                        size="sm"
                        aria-pressed={selected}
                        onClick={() => toggle(o.id)}
                      >
                        {selected ? 'Comparing' : 'Compare'}
                        <span className="sr-only"> {o.name}</span>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="No sample options match"
              description="Change or clear the filters to see more fictional options."
            />
          )}
        </Panel>
        <Panel
          title="Comparison"
          description={`${compared.length} of ${COMPARE_LIMIT} selected · illustrative values`}
          className="consult-compare"
        >
          <p className="consult-message" role="status">
            {!detail && message}
          </p>
          {compared.length ? (
            <div className="table-wrap">
              <table aria-label="consultation comparison">
                <thead>
                  <tr>
                    <th scope="col">Detail</th>
                    {compared.map((o) => (
                      <th scope="col" key={o.id}>
                        <span className="compare-heading">
                          {o.name}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggle(o.id)}
                            aria-label={`Remove ${o.name} from comparison`}
                          >
                            <X size={16} />
                          </Button>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      {compared.map((o) => (
                        <td key={o.id}>{row.value(o)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Nothing to compare yet"
              description="Select Compare on up to three fictional options to see them side by side."
            />
          )}
        </Panel>
      </div>
      <div className="mt-6">
        <Notice>
          Every provider, place and fee here is invented. A fee marked illustrative is an example,
          “free” is not a verified free service, and no option shows real availability or accepts a
          booking.
        </Notice>
      </div>
      <DialogPanel
        open={!!detail}
        onOpenChange={(open) => !open && showDetail(null)}
        title={detail?.name ?? 'Sample option'}
        description="Fictional provider · illustrative details"
      >
        {detail && (
          <>
            <dl className="detail-grid">
              {COMPARE_ROWS.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value(detail)}</dd>
                </div>
              ))}
            </dl>
            <p className="muted mt-4">{detail.note}</p>
            <div className="mt-4">
              <Badge>No contact details or booking in this demonstration</Badge>
            </div>
            <div className="form-actions">
              <p className="consult-message" role="status">
                {message}
              </p>
              <Button
                variant={compare.includes(detail.id) ? 'secondary' : 'primary'}
                onClick={() => toggle(detail.id)}
              >
                {compare.includes(detail.id) ? 'Remove from comparison' : 'Add to comparison'}
              </Button>
            </div>
          </>
        )}
      </DialogPanel>
    </>
  );
}
