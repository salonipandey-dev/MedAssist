import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Button, EmptyState } from './index';
export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
}
interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  getId: (row: T) => string;
  getSearch: (row: T) => string;
  getStatus?: (row: T) => string;
  filterOptions?: string[];
  searchPlaceholder?: string;
  label: string;
  pageSize?: number;
}
export function DataTable<T>({
  rows,
  columns,
  getId,
  getSearch,
  getStatus,
  filterOptions,
  searchPlaceholder = 'Search sample records…',
  label,
  pageSize = 6,
}: Props<T>) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [sort, setSort] = useState<{ key: string; direction: 1 | -1 } | null>(null);
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const result = rows.filter(
      (row) =>
        getSearch(row).toLowerCase().includes(query.toLowerCase()) &&
        (status === 'All' || getStatus?.(row) === status),
    );
    const col = columns.find((c) => c.key === sort?.key);
    if (col?.sortValue && sort)
      result.sort((a, b) => {
        const x = col.sortValue!(a),
          y = col.sortValue!(b);
        return (
          (typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x).localeCompare(String(y))) * sort.direction
        );
      });
    return result;
  }, [rows, query, status, sort, columns, getSearch, getStatus]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return (
    <>
      <div className="toolbar">
        <label className="search-field">
          <span className="sr-only">Search {label}</span>
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
          />
        </label>
        {filterOptions && (
          <label className="flex-center">
            <SlidersHorizontal size={14} className="muted" />
            <span className="sr-only">Filter {label}</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="All">All statuses</option>
              {filterOptions.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        )}
        <span className="muted text-small" style={{ marginLeft: 'auto' }}>
          {filtered.length} records
        </span>
      </div>
      {filtered.length ? (
        <div className="table-wrap">
          <table aria-label={label}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      col.sortValue
                        ? sort?.key === col.key
                          ? sort.direction === 1
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                        : undefined
                    }
                  >
                    {col.sortValue ? (
                      <button
                        className="sort-button"
                        onClick={() =>
                          setSort((s) => ({
                            key: col.key,
                            direction: s?.key === col.key && s.direction === 1 ? -1 : 1,
                          }))
                        }
                      >
                        {col.label}
                        {sort?.key === col.key ? (
                          sort.direction === 1 ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          )
                        ) : (
                          <ArrowUpDown size={12} />
                        )}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={getId(row)}>
                  {columns.map((col) => (
                    <td key={col.key}>{col.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No matching records"
          description="Try another search or clear your filters."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setQuery('');
                setStatus('All');
              }}
            >
              Clear filters
            </Button>
          }
        />
      )}
      <div className="pagination" aria-label={`${label} pagination`}>
        <span aria-live="polite">
          {filtered.length
            ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length}`
            : '0 records'}{' '}
          · Sample Data
        </span>
        <div className="inline-actions">
          <Button
            variant="secondary"
            size="icon"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
            aria-label={`Previous ${label} page`}
          >
            <ChevronLeft size={15} />
          </Button>
          <span>
            Page {currentPage} of {pages}
          </span>
          <Button
            variant="secondary"
            size="icon"
            disabled={currentPage >= pages}
            onClick={() => setPage(currentPage + 1)}
            aria-label={`Next ${label} page`}
          >
            <ChevronRight size={15} />
          </Button>
        </div>
      </div>
    </>
  );
}
