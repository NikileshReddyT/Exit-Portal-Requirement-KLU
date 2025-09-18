import React from 'react';
import { Link } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';

const Breadcrumbs = ({ items = [] }) => {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="w-full" role="navigation">
      <ol role="list" className="flex items-center gap-1 text-xs sm:text-sm text-gray-500 whitespace-nowrap overflow-hidden min-w-0">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li
              key={`${item.label}-${idx}`}
              className={`inline-flex items-center min-w-0 ${isLast ? 'flex-1' : ''}`}
            >
              {idx > 0 && (
                <FiChevronRight aria-hidden className="mx-1 text-gray-400 shrink-0" />
              )}
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className="px-1 py-0.5 rounded hover:text-red-900 hover:bg-red-50 transition-colors truncate inline-block max-w-[25vw] sm:max-w-[20vw]"
                  title={item.label}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  title={item.label}
                  className={`px-1 py-0.5 ${isLast ? 'text-brand-charcoal font-semibold truncate block max-w-[60vw] sm:max-w-none' : 'truncate inline-block max-w-[25vw] sm:max-w-[20vw]'}`}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
