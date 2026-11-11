import { MapPin, Search, TriangleAlert, Unplug, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  filterConsultations,
  toggleCompare,
  type ConsultationFilters,
  type FeeFilter,
} from '../../data/mock/consultations';
import {
  ConsultationApiError,
  listConsultations,
  type ConsultationListing,
  type ConsultationPage,
} from '../../services/api/consultations';
import { readApiOrigin } from '../../services/api/origin';
import {
  feeLabel,
  fromOfflineOption,
  LISTING_ROWS,
  MODE_LABELS,
  PROVIDER_TYPE_LABELS,
  sourceLabel,
  toConsultationQuery,
} from './listing';

const FEE_FILTERS: FeeFilter[] = ['Any', 'Free (illustrative)', 'Up to ₹300', 'Fee not listed'];
const COMPARE_LIMIT_MESSAGE = `You can compare up to ${COMPARE_LIMIT} options. Remove one to add another.`;
const SEARCH_DEBOUNCE_MS = 300;
const OFFLINE_LISTINGS = CONSULTATION_OPTIONS.map(fromOfflineOption);

export function Consultations() {
  const [params, setParams] = useSearchParams();
  const offline = params.get('source') === 'offline';
  return (
    <>
      <PageHeading
        eyebrow="Patient · Consultations"
        title="Find and compare consultations"
        description="Search the fictional consultation directory and compare up to three options. Providers, places and fees are invented, and nothing here can be booked."
      />
      {offline ? (
        <OfflineDirectory onUseApi={() => setParams({})} />
      ) : (
        <ApiDirectory onOpenOffline={() => setParams({ source: 'offline' })} />
      )}
      <div className="mt-6">
        <Notice>
          Every provider, place and fee here is invented. A fee marked illustrative is an example,
          “free” is not a verified free service, and no option shows real availability or accepts a
          booking.
        </Notice>
      </div>
    </>
  );
}

/** Applies typing after a pause; clearing the box applies at once. */
function useDebouncedText(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (value === '') {
      setDebounced('');
      return;
    }
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return value === '' ? '' : debounced;
}

type Loaded =
  | { status: 'loading'; page: ConsultationPage | null }
  | { status: 'ready'; page: ConsultationPage }
  | { status: 'error'; error: ConsultationApiError };

function ApiDirectory({ onOpenOffline }: { onOpenOffline: () => void }) {
  const api = readApiOrigin();
  const [filters, setFilters] = useState<ConsultationFilters>(EMPTY_FILTERS);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading', page: null });
  const searchText = useDebouncedText(filters.query, SEARCH_DEBOUNCE_MS);
  // Only changes to the effective server filters start a request.
  const queryKey = JSON.stringify(toConsultationQuery({ ...filters, query: searchText }));

  useEffect(() => {
    if (!api.ok) return;
    // Aborting on cleanup means an older response can never replace a newer one.
    const controller = new AbortController();
    setLoaded((previous) => ({
      status: 'loading',
      page: previous.status === 'error' ? null : previous.page,
    }));
    listConsultations(JSON.parse(queryKey), { signal: controller.signal }).then(
      (page) => {
        if (!controller.signal.aborted) setLoaded({ status: 'ready', page });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({
          status: 'error',
          error:
            error instanceof ConsultationApiError ? error : new ConsultationApiError('unexpected'),
        });
      },
    );
    return () => controller.abort();
  }, [api.ok, queryKey, attempt]);

  const source = (
    <SourceBar
      badge={<Badge tone="indigo">Directory API</Badge>}
      action="Open offline demo"
      onAction={onOpenOffline}
    >
      {api.ok ? (
        <>
          Listings are read from <code>{api.origin}</code>.
        </>
      ) : (
        'Not connected in this build.'
      )}
    </SourceBar>
  );

  if (!api.ok)
    return (
      <DirectoryBrowser
        title="Consultation directory"
        description="Not connected"
        listLabel="Consultation listings"
        source={source}
        filters={null}
        onFiltersChange={setFilters}
        items={[]}
        body={
          <StateBlock
            icon={<Unplug size={25} />}
            title={
              api.reason === 'missing'
                ? 'Directory API not connected'
                : 'Directory API address is not valid'
            }
          >
            <p>
              {api.reason === 'missing'
                ? 'This build has no API address, so no request was made.'
                : 'The configured API address is not a plain HTTP(S) origin, so no request was made.'}{' '}
              Set VITE_API_BASE_URL to the MedAssist API origin and restart the frontend, or open
              the offline demo above.
            </p>
          </StateBlock>
        }
      />
    );

  const page = loaded.status === 'error' ? null : loaded.page;
  const filtered = queryKey !== '{}';
  let description = 'Loading listings…';
  if (loaded.status === 'error') description = 'Listings could not be loaded';
  else if (page) {
    const noun = `${filtered ? 'matching ' : ''}listing${page.total === 1 ? '' : 's'}`;
    description =
      page.items.length < page.total
        ? `Showing ${page.items.length} of ${page.total} ${noun}`
        : `${page.total} ${noun}`;
    if (loaded.status === 'loading') description += ' · updating…';
  }

  let body: ReactNode = null;
  if (loaded.status === 'error')
    body = (
      <StateBlock
        alert
        icon={<TriangleAlert size={25} />}
        title={
          loaded.error.kind === 'unavailable'
            ? 'Directory temporarily unavailable'
            : loaded.error.kind === 'network' || loaded.error.kind === 'timeout'
              ? 'Could not reach the directory API'
              : 'The directory request failed'
        }
        action={<Button onClick={() => setAttempt((n) => n + 1)}>Retry</Button>}
      >
        <p>{loaded.error.message} No listings are shown until the directory responds.</p>
        {loaded.error.requestId && (
          <p className="consult-request-id">Request ID: {loaded.error.requestId}</p>
        )}
      </StateBlock>
    );
  else if (!page)
    body = (
      <div className="skeleton-stack" role="status">
        <span className="sr-only">Loading consultation listings</span>
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );

  return (
    <DirectoryBrowser
      title="Consultation directory"
      description={description}
      listLabel="Consultation listings"
      source={source}
      filters={filters}
      onFiltersChange={setFilters}
      items={page?.items ?? []}
      busy={loaded.status === 'loading'}
      body={body}
      emptyTitle="No listings match"
      emptyDescription="The directory has no listing for these filters. Change or clear them to see more."
    />
  );
}

function OfflineDirectory({ onUseApi }: { onUseApi: () => void }) {
  const [filters, setFilters] = useState<ConsultationFilters>(EMPTY_FILTERS);
  const items = useMemo(() => {
    const ids = new Set(filterConsultations(CONSULTATION_OPTIONS, filters).map((o) => o.id));
    return OFFLINE_LISTINGS.filter((listing) => ids.has(listing.id));
  }, [filters]);
  return (
    <DirectoryBrowser
      title="Offline demo directory"
      description={`${items.length} of ${OFFLINE_LISTINGS.length} sample options`}
      listLabel="Sample consultation options"
      source={
        <SourceBar
          badge={<Badge tone="amber">Offline demo</Badge>}
          action="Use directory API"
          onAction={onUseApi}
        >
          Built-in fictional sample. No request is sent and nothing comes from the directory API.
        </SourceBar>
      }
      filters={filters}
      onFiltersChange={setFilters}
      items={items}
      body={null}
      emptyTitle="No sample options match"
      emptyDescription="Change or clear the filters to see more fictional options."
    />
  );
}

function SourceBar({
  badge,
  children,
  action,
  onAction,
}: {
  badge: ReactNode;
  children: ReactNode;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="consult-source">
      <p>
        {badge}
        <span>{children}</span>
      </p>
      <Button variant="secondary" size="sm" onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}

function StateBlock({
  icon,
  title,
  children,
  action,
  alert = false,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  alert?: boolean;
}) {
  return (
    <div className="empty-state consult-state" role={alert ? 'alert' : undefined}>
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      {children}
      {action}
    </div>
  );
}

function DirectoryBrowser({
  title,
  description,
  listLabel,
  source,
  filters,
  onFiltersChange,
  items,
  busy = false,
  body,
  emptyTitle = '',
  emptyDescription = '',
}: {
  title: string;
  description: string;
  listLabel: string;
  source: ReactNode;
  /** null hides the filter controls, for a directory that cannot be queried. */
  filters: ConsultationFilters | null;
  onFiltersChange: (filters: ConsultationFilters) => void;
  items: ConsultationListing[];
  busy?: boolean;
  /** Replaces the list with a loading, error or configuration state. */
  body: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const searchInput = useRef<HTMLInputElement>(null);
  // Selections hold the listing itself, keyed by its stable ID, so they stay in the
  // comparison when a later search no longer returns them.
  const [compare, setCompare] = useState<ConsultationListing[]>([]);
  const [detail, setDetail] = useState<ConsultationListing | null>(null);
  const [blockedOptionId, setBlockedOptionId] = useState<string | null>(null);
  const latest = (listing: ConsultationListing) =>
    items.find((item) => item.id === listing.id) ?? listing;
  const compared = compare.map(latest);
  const shown = detail && latest(detail);
  const isCompared = (id: string) => compare.some((listing) => listing.id === id);
  const filtered = filters !== null && JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  function set<K extends keyof ConsultationFilters>(key: K, value: ConsultationFilters[K]) {
    if (filters) onFiltersChange({ ...filters, [key]: value });
    setBlockedOptionId(null);
  }
  function clearFilters() {
    onFiltersChange(EMPTY_FILTERS);
    setBlockedOptionId(null);
    searchInput.current?.focus();
  }
  function showDetail(listing: ConsultationListing | null) {
    setDetail(listing);
    setBlockedOptionId(null);
  }
  function toggle(listing: ConsultationListing) {
    const ids = compare.map((selected) => selected.id);
    const next = toggleCompare(ids, listing.id);
    setBlockedOptionId(next === ids ? listing.id : null);
    if (next !== ids)
      setCompare(next.map((id) => compare.find((selected) => selected.id === id) ?? listing));
  }

  return (
    <>
      {source}
      <div className="consult-layout">
        <Panel title={title} description={description}>
          <p className="sr-only" role="status">
            {description}
          </p>
          {filters && (
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
                <select
                  value={filters.specialty}
                  onChange={(e) => set('specialty', e.target.value)}
                >
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
                  {Object.values(MODE_LABELS).map((mode) => (
                    <option key={mode}>{mode}</option>
                  ))}
                </select>
              </label>
              <label className="consult-filter">
                <span>Fee</span>
                <select
                  value={filters.fee}
                  onChange={(e) => set('fee', e.target.value as FeeFilter)}
                >
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
          )}
          {body ??
            (items.length ? (
              <ul className="consult-list" aria-label={listLabel} aria-busy={busy}>
                {items.map((o) => {
                  const selected = isCompared(o.id);
                  return (
                    <li key={o.id} className={selected ? 'selected' : undefined}>
                      <div className="consult-main">
                        <strong>{o.provider_name}</strong>
                        <span>
                          {o.specialty} · {PROVIDER_TYPE_LABELS[o.provider_type]}
                        </span>
                        <span className="consult-area">
                          <MapPin size={14} />
                          {o.area}
                        </span>
                      </div>
                      <div className="consult-meta">
                        <span className="consult-fee">{feeLabel(o)}</span>
                        <span className="consult-modes">
                          {o.modes.map((mode) => MODE_LABELS[mode]).join(' · ')}
                        </span>
                        {o.is_fictional && <span className="consult-flag">Fictional record</span>}
                      </div>
                      <div className="consult-actions">
                        <Button variant="ghost" size="sm" onClick={() => showDetail(o)}>
                          Details
                        </Button>
                        <Button
                          variant={selected ? 'primary' : 'secondary'}
                          size="sm"
                          aria-pressed={selected}
                          onClick={() => toggle(o)}
                        >
                          {selected ? 'Comparing' : 'Compare'}
                          <span className="sr-only"> {o.provider_name}</span>
                        </Button>
                      </div>
                      <p className="consult-message" role="status">
                        {!detail && blockedOptionId === o.id && COMPARE_LIMIT_MESSAGE}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState title={emptyTitle} description={emptyDescription} />
            ))}
        </Panel>
        <Panel
          title="Comparison"
          description={`${compared.length} of ${COMPARE_LIMIT} selected · illustrative values`}
          className="consult-compare"
        >
          {compared.length ? (
            <div className="table-wrap">
              <table aria-label="consultation comparison">
                <thead>
                  <tr>
                    <th scope="col">Detail</th>
                    {compared.map((o) => (
                      <th scope="col" key={o.id}>
                        <span className="compare-heading">
                          {o.provider_name}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggle(o)}
                            aria-label={`Remove ${o.provider_name} from comparison`}
                          >
                            <X size={16} />
                          </Button>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LISTING_ROWS.map((row) => (
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
      <DialogPanel
        open={!!shown}
        onOpenChange={(open) => !open && showDetail(null)}
        title={shown?.provider_name ?? 'Listing'}
        description={
          shown?.is_fictional === false
            ? 'Directory listing'
            : 'Fictional provider · illustrative details'
        }
      >
        {shown && (
          <>
            <dl className="detail-grid">
              {LISTING_ROWS.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value(shown)}</dd>
                </div>
              ))}
            </dl>
            {shown.notes && shown.notes !== shown.fee.basis && (
              <p className="muted mt-4">{shown.notes}</p>
            )}
            <p className="muted text-small mt-4">Source: {sourceLabel(shown)}</p>
            <div className="mt-4">
              <Badge>No contact details or booking in this demonstration</Badge>
            </div>
            <div className="form-actions">
              <p className="consult-message" role="status">
                {blockedOptionId === shown.id && COMPARE_LIMIT_MESSAGE}
              </p>
              <Button
                variant={isCompared(shown.id) ? 'secondary' : 'primary'}
                onClick={() => toggle(shown)}
              >
                {isCompared(shown.id) ? 'Remove from comparison' : 'Add to comparison'}
              </Button>
            </div>
          </>
        )}
      </DialogPanel>
    </>
  );
}
