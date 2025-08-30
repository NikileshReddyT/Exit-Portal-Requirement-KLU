import React from 'react';

const DetailsDrawer = ({ open, title, subtitle, onClose, children, widthClass = 'max-w-md' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`absolute right-0 top-0 h-full w-full ${widthClass} bg-white shadow-xl flex flex-col`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            {title && (
              <h3 id="drawer-title" className="text-lg font-semibold text-gray-900">{title}</h3>
            )}
            {subtitle && (
              <p className="text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
          <button
            className="px-3 py-1.5 border rounded hover:bg-gray-50 text-sm"
            onClick={onClose}
            aria-label="Close details"
          >
            Close
          </button>
        </div>
        <div className="p-4 overflow-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

export default DetailsDrawer;
