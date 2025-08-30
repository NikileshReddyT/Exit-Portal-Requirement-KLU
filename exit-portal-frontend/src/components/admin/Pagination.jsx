import React from 'react';

const Pagination = ({
  page = 0,
  size = 25,
  totalPages = 0,
  totalElements = 0,
  onPageChange,
  onSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}) => {
  const canPrev = page > 0;
  const canNext = totalPages ? page < totalPages - 1 : false;

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Rows:</span>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={size}
          onChange={(e) => onSizeChange && onSizeChange(parseInt(e.target.value, 10))}
        >
          {pageSizeOptions.map((opt) => (
            <option value={opt} key={opt}>{opt}</option>
          ))}
        </select>
      </div>
      <div className="text-sm text-gray-600">
        Page {page + 1} of {Math.max(1, totalPages || 1)} — {totalElements} records
      </div>
      <div className="flex gap-2">
        <button
          className="px-3 py-1.5 border rounded hover:bg-gray-50 text-sm disabled:opacity-50"
          disabled={!canPrev}
          onClick={() => onPageChange && onPageChange(Math.max(page - 1, 0))}
        >
          Prev
        </button>
        <button
          className="px-3 py-1.5 border rounded hover:bg-gray-50 text-sm disabled:opacity-50"
          disabled={!canNext}
          onClick={() => onPageChange && onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Pagination;
