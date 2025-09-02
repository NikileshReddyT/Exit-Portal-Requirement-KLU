import React, { useEffect, useMemo, useState } from 'react';
import Pagination from './Pagination';

// Modern, mobile-first data table with card view and optional server-side pagination
// Props:
// - columns: [{ key, header, render?, className?, mobileHide?, width? }]
// - rows: array of objects
// - loading, error, emptyText
// - serverSide: boolean (if true, uses provided page/size/totalPages/totalElements and handlers)
// - page, size, totalPages, totalElements, onPageChange, onSizeChange
// - onRowClick(row)
// - cardTitleKey: which key to emphasize in mobile cards
// - compact: boolean (smaller padding and text)
const DataTable = ({
  columns,
  rows = [],
  loading = false,
  error = '',
  emptyText = 'No data',
  serverSide = false,
  page = 0,
  size = 25,
  totalPages = 0,
  totalElements = 0,
  onPageChange,
  onSizeChange,
  onRowClick,
  cardTitleKey,
  compact = false,
  // Enhancements
  enableSearch = true,
  enableColumnFilters = false,
  enableColumnVisibility = true,
  enableExport = true,
  exportFileName = 'data',
  searchPlaceholder = 'Search...',
  defaultSearch = '',
  onSearchChange,
}) => {
  const inferredColumns = useMemo(() => {
    if (Array.isArray(columns) && columns.length) return columns;
    const first = rows && rows.length ? rows[0] : null;
    if (!first) return [];
    return Object.keys(first).map((k) => ({ key: k, header: k }));
  }, [columns, rows]);

  // Column visibility controls
  const [colVisibility, setColVisibility] = useState({});
  const visibleColumns = useMemo(
    () => inferredColumns.filter((c) => colVisibility[c.key] !== false),
    [inferredColumns, colVisibility]
  );

  // Mobile columns (respect visibility)
  const mobileColumns = useMemo(() => visibleColumns.filter((c) => !c.mobileHide), [visibleColumns]);
  // Show all visible columns on mobile for completeness
  const mobileColumnsLimited = useMemo(() => mobileColumns, [mobileColumns]);

  // client-side pagination & sorting
  const [clientPage, setClientPage] = useState(0);
  const [clientSize, setClientSize] = useState(25);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [search, setSearch] = useState(defaultSearch || '');
  const [columnFilters, setColumnFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  // Removed wrap toggle and column visibility menu per new spec

  // Sync search input when defaultSearch prop changes (e.g., URL back/forward)
  useEffect(() => {
    setSearch(defaultSearch || '');
  }, [defaultSearch]);

  // Apply client-side filtering (global search + per-column) when not server-side
  const effectiveRows = useMemo(() => {
    if (!rows) return [];
    if (serverSide) return rows;
    const s = (search || '').trim().toLowerCase();
    const hasSearch = !!s;
    const activeFilters = columnFilters || {};
    return rows.filter((row) => {
      // Per-column filters (contains, case-insensitive)
      for (const [k, val] of Object.entries(activeFilters)) {
        if (!val) continue;
        const cell = row?.[k];
        const cellStr = cell == null ? '' : String(cell).toLowerCase();
        if (!cellStr.includes(String(val).toLowerCase())) return false;
      }
      if (!hasSearch) return true;
      // Global search across visible columns
      return (visibleColumns.length ? visibleColumns : inferredColumns).some((c) => {
        const cell = row?.[c.key];
        if (cell == null) return false;
        return String(cell).toLowerCase().includes(s);
      });
    });
  }, [rows, serverSide, search, columnFilters, inferredColumns, visibleColumns]);

  const sortedRows = useMemo(() => {
    if (!effectiveRows) return [];
    if (serverSide || !sortKey) return effectiveRows;
    const copy = [...effectiveRows];
    copy.sort((a, b) => {
      const va = a?.[sortKey];
      const vb = b?.[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return sortDir === 'asc' ? -1 : 1;
      if (vb == null) return sortDir === 'asc' ? 1 : -1;
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      const sa = String(va);
      const sb = String(vb);
      return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return copy;
  }, [effectiveRows, serverSide, sortKey, sortDir]);

  const clientTotalElements = sortedRows.length;
  const clientTotalPages = Math.ceil(clientTotalElements / clientSize) || 1;
  const pageToUse = serverSide ? page : clientPage;
  const sizeToUse = serverSide ? size : clientSize;
  const totalPagesToUse = serverSide ? (totalPages || 1) : clientTotalPages;
  const totalElementsToUse = serverSide ? (totalElements || rows.length) : clientTotalElements;

  const pagedRows = useMemo(() => {
    if (serverSide) return sortedRows;
    const start = pageToUse * sizeToUse;
    return sortedRows.slice(start, start + sizeToUse);
  }, [sortedRows, serverSide, pageToUse, sizeToUse]);

  const handleHeaderClick = (key) => {
    if (serverSide) return; // client-side sort only for now
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Humanize headers: insert spaces for camelCase and underscores
  const formatHeader = (value) => {
    const raw = value == null ? '' : String(value);
    // Replace camelCase boundaries and underscores with spaces
    return raw.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  };

  // Compute unique values per column for dropdown filters
  const uniqueValuesByColumn = useMemo(() => {
    const map = {};
    (inferredColumns || []).forEach((col) => {
      const set = new Set();
      (rows || []).forEach((r) => {
        const v = r?.[col.key];
        if (v != null && v !== '') set.add(String(v));
      });
      map[col.key] = Array.from(set).sort((a, b) => a.localeCompare(b));
    });
    return map;
  }, [rows, inferredColumns]);

  // Highlight helper for global search term
  const highlightText = (text, term) => {
    const value = text == null ? '' : String(text);
    const t = (term || '').trim();
    if (!t) return value;
    try {
      const regex = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
      const parts = value.split(regex);
      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 text-gray-900 px-0.5 rounded">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      );
    } catch {
      return value;
    }
  };

  // CSV export using visible columns and current filtered/sorted rows
  const downloadCSV = () => {
    const cols = visibleColumns.length ? visibleColumns : inferredColumns;
    const header = cols.map((c) => '"' + String(c.header ?? c.key).replace(/"/g, '""') + '"').join(',');
    const dataLines = (serverSide ? sortedRows : sortedRows).map((row) => {
      return cols
        .map((c) => {
          const raw = row?.[c.key];
          const str = raw == null ? '' : String(raw);
          const needsQuote = /[",\n]/.test(str);
          const escaped = str.replace(/"/g, '""');
          return needsQuote ? `"${escaped}"` : escaped;
        })
        .join(',');
    });
    const csv = [header, ...dataLines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${exportFileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-4 w-full lg:max-w-[80vw] max-h-[70vh]">
        {/* Mobile loading cards */}
        <div className="grid gap-3 md:hidden max-h-[70vh] overflow-y-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
              <div className="flex justify-between items-start mb-3">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-3 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded w-full"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Desktop loading table */}
        <div className="hidden md:block bg-white rounded-2xl border border-gray-100 w-full max-w-full max-h-[70vh]">
          <div className="overflow-auto max-w-full max-h-[70vh]">
            <table className="w-max min-w-full">
              <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                <tr className="divide-x divide-gray-200">
                  {inferredColumns.length > 0 ? inferredColumns.map((col) => (
                    <th key={col.key} className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px] animate-pulse">
                      <div className="h-3 bg-gray-300 rounded w-20"></div>
                    </th>
                  )) : [1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <th key={i} className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px] animate-pulse">
                      <div className="h-3 bg-gray-300 rounded w-20"></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((i) => (
                  <tr key={i} className="divide-x divide-gray-100 animate-pulse">
                    {(inferredColumns.length > 0 ? inferredColumns : [1, 2, 3, 4, 5, 6, 7]).map((col, j) => (
                      <td key={j} className="px-3 py-3 text-sm max-w-[200px]">
                        <div className="h-4 bg-gray-200 rounded w-full"></div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-red-100 p-6 text-center">
        <div className="text-red-600 text-sm font-medium mb-2">Error</div>
        <div className="text-gray-600 text-sm">{error}</div>
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <div className="text-gray-400 text-4xl mb-4">📊</div>
        <div className="text-gray-600 font-medium mb-1">No Data Found</div>
        <div className="text-gray-500 text-sm">{emptyText}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full  lg:max-w-[90vw] max-h-[90vh]">
      {(enableSearch || enableExport || enableColumnFilters) && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Left spacer (kept empty to push controls to the right) */}
          <div className="hidden md:block" />
          {/* Right controls: export then search (search on far right) */}
          <div className="flex items-center gap-2 md:ml-auto md:justify-end w-full">
            {enableColumnFilters && (
              <button
                type="button"
                className={`px-3 py-2 border rounded text-sm hover:bg-gray-50 flex items-center gap-1 ${showFilters ? 'bg-gray-100' : ''}`}
                onClick={() => setShowFilters((v) => !v)}
                title={showFilters ? 'Hide column filters' : 'Show column filters'}
              >
                <svg
                  className="w-4 h-4 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Filter</span>
              </button>
            )}
            {enableExport && (
              <button
                type="button"
                className="px-3 py-2 border rounded text-sm hover:bg-gray-50"
                onClick={downloadCSV}
                title="Export visible columns to CSV"
              >
                Export CSV
              </button>
            )}
            {enableSearch && (
              <div className="relative w-full max-w-sm">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearch(val);
                    if (onSearchChange) onSearchChange(val);
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full border rounded pl-3 pr-8 py-2 text-sm"
                />
                <svg
                  className="absolute right-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Mobile card view */}
      <div className="grid gap-3 md:hidden max-h-[70vh] overflow-y-auto">
        {pagedRows.map((row, idx) => {
          const clickable = !!onRowClick;
          return (
            <div
              key={idx}
              className={`bg-white rounded-2xl border border-gray-100 p-4 transition-all duration-200 ${
                clickable ? 'hover:shadow-md hover:border-gray-200 cursor-pointer active:scale-[0.99]' : ''
              }`}
              onClick={clickable ? () => onRowClick(row) : undefined}
            >
              {cardTitleKey && (
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-50">
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {String(row[cardTitleKey] ?? 'Details')}
                  </h3>
                  {clickable && (
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              )}
              <div className="space-y-2">
                {mobileColumnsLimited.map((col) => {
                  const valueRaw = col.render ? col.render(row[col.key], row) : row[col.key];
                  const value = highlightText(valueRaw, search);
                  return (
                    <div key={col.key} className="flex justify-between items-start">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide flex-shrink-0 mr-3">
                        {formatHeader(col.header ?? col.key)}
                      </span>
                      <span className="text-sm text-gray-900 text-right break-words">
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 w-full max-w-full max-h-[70vh]">
        <div className="overflow-auto max-w-full max-h-[60vh] ">
          <table className="w-max min-w-full max-h-[70vh] ">
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
              <tr className="divide-x divide-gray-200">
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-4 text-left text-xs font-black bg-red-900 text-white uppercase tracking-wider whitespace-nowrap ${col.width ? col.width : 'min-w-[120px]'}`}
                  >
                    <div
                      className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer select-none min-w-0"
                      onClick={() => handleHeaderClick(col.key)}
                      title="Click to sort"
                    >
                      <span className="truncate">{formatHeader(col.header ?? col.key)}</span>
                      {!serverSide && sortKey === col.key && (
                        <span className="text-blue-500 text-xs flex-shrink-0">
                          {sortDir === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
              {enableColumnFilters && showFilters && (
                <tr className="divide-x divide-gray-200 bg-gray-50">
                  {visibleColumns.map((col) => (
                    <th key={col.key} className="px-2 py-2">
                      <select
                        value={columnFilters[col.key] || ''}
                        onChange={(e) => setColumnFilters((prev) => ({ ...prev, [col.key]: e.target.value }))}
                        className="w-full border rounded px-2 py-1 text-xs bg-white"
                      >
                        <option value="">All</option>
                        {(uniqueValuesByColumn[col.key] || []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pagedRows.map((row, rIdx) => {
                const clickable = !!onRowClick;
                return (
                  <tr
                    key={rIdx}
                    className={`transition-colors divide-x divide-gray-100 ${
                      clickable ? 'hover:bg-red-100 cursor-pointer' : ''
                    } ${rIdx % 2 === 0 ? 'bg-white' : 'bg-red-50'}`}
                    onClick={clickable ? () => onRowClick(row) : undefined}
                  >
                    {visibleColumns.map((col) => {
                      const valueRaw = col.render ? col.render(row[col.key], row) : row[col.key];
                      const value = highlightText(valueRaw, search);
                      return (
                        <td 
                          key={col.key} 
                          className={`px-3 text-sm text-gray-700 ${compact ? 'py-2' : 'py-3'} ${col.className || ''} max-w-[260px]`}
                        >
                          <div className="truncate" title={String(typeof valueRaw === 'string' ? valueRaw : '')}>
                            {value}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {(totalPagesToUse > 1 || totalElementsToUse > sizeToUse) && (
        <Pagination
          page={pageToUse}
          size={sizeToUse}
          totalPages={totalPagesToUse}
          totalElements={totalElementsToUse}
          onPageChange={serverSide ? onPageChange : setClientPage}
          onSizeChange={serverSide ? (val) => onSizeChange && onSizeChange(val) : setClientSize}
        />
      )}
    </div>
  );
};

// Export a compact variant
export const CompactDataTable = (props) => (
  <DataTable {...props} compact={true} />
);

export default DataTable;
