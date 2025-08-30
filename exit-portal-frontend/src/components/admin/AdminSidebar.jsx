import React from 'react';

const NavItem = ({ href, label }) => (
  <a
    href={href}
    className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 text-gray-700"
  >
    <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
    <span className="text-sm">{label}</span>
  </a>
);

const AdminSidebar = ({ showProgramLinks = false }) => {
  return (
    <aside className="hidden lg:block w-56 shrink-0">
      <div className="sticky top-4 bg-white border rounded-lg p-3 shadow-sm">
        <div className="px-2 py-1 text-xs uppercase tracking-wide text-gray-500">Navigation</div>
        <nav className="mt-2 flex flex-col">
          <NavItem href="#section-overview" label="Overview" />
          <NavItem href="#section-bottlenecks" label="Top Bottlenecks" />
          {showProgramLinks && (
            <>
              <NavItem href="#section-program-overview" label="Program Overview" />
              <NavItem href="#section-program-bottlenecks" label="Program Bottlenecks" />
              <NavItem href="#section-program-category-summaries" label="Program Category Summaries" />
            </>
          )}
          <NavItem href="#section-rankings" label="Rankings" />
          <NavItem href="#section-category-summaries" label="Category Summaries" />
          <NavItem href="#section-actions" label="Quick Actions" />
          <NavItem href="#section-explorer" label="Data Explorer" />
        </nav>
      </div>
    </aside>
  );
};

export default AdminSidebar;
