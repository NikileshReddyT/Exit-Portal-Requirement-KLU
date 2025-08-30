import React, { useMemo, useState } from 'react';
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
}) => {
  const inferredColumns = useMemo(() => {
    if (Array.isArray(columns) && columns.length) return columns;
    const first = rows && rows.length ? rows[0] : null;
    if (!first) return [];
    return Object.keys(first).map((k) => ({ key: k, header: k }));
  }, [columns, rows]);

  const mobileColumns = useMemo(() => inferredColumns.filter((c) => !c.mobileHide), [inferredColumns]);
  const mobileColumnsLimited = useMemo(() => mobileColumns.slice(0, 4), [mobileColumns]);

  // client-side pagination & sorting
  const [clientPage, setClientPage] = useState(0);
  const [clientSize, setClientSize] = useState(25);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const sortedRows = useMemo(() => {
    if (!rows) return [];
    if (serverSide || !sortKey) return rows;
    const copy = [...rows];
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
  }, [rows, serverSide, sortKey, sortDir]);

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
    <div className="space-y-4 w-full  lg:max-w-[80vw] max-h-[70vh]">
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
                  const value = col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '');
                  return (
                    <div key={col.key} className="flex justify-between items-start">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide flex-shrink-0 mr-3">
                        {col.header}
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
        <div className="overflow-auto max-w-full max-h-[70vh] ">
          <table className="w-max min-w-full max-h-[70vh]">
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
              <tr className="divide-x divide-gray-200">
                {inferredColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap ${col.width ? col.width : 'min-w-[120px]'}`}
                  >
                    <div
                      className="flex items-center gap-1 hover:text-gray-900 transition-colors cursor-pointer select-none min-w-0"
                      onClick={() => handleHeaderClick(col.key)}
                      title="Click to sort"
                    >
                      <span className="truncate">{col.header}</span>
                      {!serverSide && sortKey === col.key && (
                        <span className="text-blue-500 text-xs flex-shrink-0">
                          {sortDir === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pagedRows.map((row, rIdx) => {
                const clickable = !!onRowClick;
                return (
                  <tr
                    key={rIdx}
                    className={`transition-colors divide-x divide-gray-100 ${
                      clickable ? 'hover:bg-gray-50 cursor-pointer' : ''
                    } ${rIdx % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}
                    onClick={clickable ? () => onRowClick(row) : undefined}
                  >
                    {inferredColumns.map((col) => {
                      const value = col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '');
                      return (
                        <td 
                          key={col.key} 
                          className={`px-3 py-3 text-sm text-gray-700 ${compact ? 'py-2' : 'py-3'} ${col.className || ''} max-w-[200px]`}
                        >
                          <div className="truncate" title={String(value)}>
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
