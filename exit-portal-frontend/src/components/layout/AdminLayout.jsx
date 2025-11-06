import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUsers, FiFolder, FiBookOpen, FiEdit3, FiTrendingUp, FiBarChart2, FiCompass, FiSettings, FiX, FiUploadCloud, FiDatabase, FiAlertTriangle } from 'react-icons/fi';
import SEO from '../SEO';

const Breadcrumbs = ({ location, user }) => {
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = [];
  
  // Add home breadcrumb for SUPER_ADMIN users
  if (user?.userType === 'SUPER_ADMIN') {
    breadcrumbs.push({ label: 'Home', path: '/superadmin/dashboard' });
  }
  
  if (pathSegments.length > 1) {
    breadcrumbs.push({ label: 'Admin', path: '/admin' });
    
    const routeMap = {
      'overview': 'Overview',
      'students': 'Students', 
      'categories': 'Categories',
      'categories-summary': 'Categories Summary',
      'student-category-matrix': 'Student Category Records',
      'insights': 'Insights',
      'courses': 'Courses',
      'grades': 'Grades',
      'progress': 'Progress',
      'users': 'Users',
      'upload': 'Data Upload',
      'analytics': 'Analytics'
    };
    
    for (let i = 1; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      const label = routeMap[segment] || segment;
      const path = '/' + pathSegments.slice(0, i + 1).join('/');
      breadcrumbs.push({ label, path });
    }
  }
  
  if (breadcrumbs.length === 0) return null;

  const firstCrumb = breadcrumbs[0];
  const lastCrumb = breadcrumbs[breadcrumbs.length - 1];
  const hasMiddle = breadcrumbs.length > 2;

  return (
    <nav aria-label="Breadcrumb" className="w-full mb-4" role="navigation">
      {/* Mobile (collapsed) */}
      <ol
        role="list"
        className="sm:hidden flex items-center gap-1 text-sm text-gray-500 overflow-hidden min-w-0"
      >
        {/* First crumb */}
        <li className="min-w-0">
          <NavLink to={firstCrumb.path} className="hover:text-gray-700 transition-colors truncate inline-block max-w-[35vw]">
            {firstCrumb.label}
          </NavLink>
        </li>
        <li className="shrink-0 px-1">/</li>
        {hasMiddle && (
          <>
            <li className="shrink-0 text-gray-400">…</li>
            <li className="shrink-0 px-1">/</li>
          </>
        )}
        {/* Last crumb */}
        {firstCrumb !== lastCrumb && (
          <li className="min-w-0 flex-1">
            <span aria-current="page" className="truncate inline-block max-w-[60vw]" title={lastCrumb.label}>
              {lastCrumb.label}
            </span>
          </li>
        )}
      </ol>

      {/* Desktop (full, truncated) */}
      <ol
        role="list"
        className="hidden sm:flex items-center gap-1 text-sm text-gray-500 overflow-hidden min-w-0"
      >
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <React.Fragment key={crumb.path}>
              {index > 0 && <li className="shrink-0 px-1">/</li>}
              <li className={`inline-flex items-center min-w-0 ${isLast ? 'flex-1' : ''}`}>
                {isLast ? (
                  <span aria-current="page" className="truncate inline-block max-w-[40vw]" title={crumb.label}>
                    {crumb.label}
                  </span>
                ) : (
                  <NavLink
                    to={crumb.path}
                    className="hover:text-gray-700 transition-colors truncate inline-block max-w-[20vw]"
                    title={crumb.label}
                  >
                    {crumb.label}
                  </NavLink>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

const NavItem = ({ to, label, end, icon, expanded = true }) => (
  <NavLink to={to} end={end} className="block w-full">
    {({ isActive }) => (
      <div
        className={`w-full h-10 flex items-center ${expanded ? 'justify-start gap-3 px-0' : 'justify-center px-0'} rounded-lg text-sm font-medium transition-all duration-200 ${
          expanded
            ? (isActive ? 'bg-[#f5eaed] text-[#681a1a] border border-[#ead5d8]' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900')
            : 'text-gray-700'
        }`}
      >
        {icon && (
          <span
            className={`text-lg w-8 h-8 grid place-items-center ${
              expanded ? '' : 'mx-auto'
            } ${
              !expanded && isActive ? 'bg-[#f5eaed] text-[#681a1a] border border-[#ead5d8] rounded-lg' : ''
            }`}
          >
            {icon}
          </span>
        )}
        {expanded && <span className="whitespace-nowrap flex-1 truncate">{label}</span>}
      </div>
    )}
  </NavLink>
);

// (no separate icon-only component needed with hover-expand)

// Accordion group supporting light/dark variants and collapsed rendering
const AccordionGroup = ({ title, children, defaultOpen = false, variant = 'light', expanded = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  const borderCls = variant === 'dark' ? 'border-white/10' : 'border-gray-200';
  const textCls = variant === 'dark' ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-700';
  if (!expanded) {
    // In collapsed mode, don't render header; just show items flat
    return <div className="mt-1 space-y-1">{children}</div>;
  }
  return (
    <div className={`border-b last:border-b-0 ${borderCls} pb-2`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-2 py-2 text-xs font-semibold uppercase tracking-wide ${textCls}`}
      >
        <span>{title}</span>
        <svg
          className={`w-4 h-4 transform transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`${open ? 'block' : 'hidden'} mt-1 space-y-1`}>
        {children}
      </div>
    </div>
  );
};

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarHover, setSidebarHover] = useState(false);
  const { programInfo } = useProgramContext();

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Determine base path and navigation items based on user type and current path
  const isSuperAdminPath = location.pathname.startsWith('/superadmin');
  const basePath = isSuperAdminPath ? '/superadmin' : '/admin';
  const roleLabel = user?.userType === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin';
  
  // Grouped navigation
  const navGroups = [
    {
      title: 'Overview',
      items: [
        { to: `${basePath}/overview`, label: 'Overview', icon: <FiBarChart2 />, end: true },
      ],
    },
    {
      title: 'Data',
      items: [
        { to: `${basePath}/students`, label: 'Students', icon: <FiUsers /> },
        { to: `${basePath}/categories`, label: 'Categories', icon: <FiFolder /> },
        { to: `${basePath}/courses`, label: 'Courses', icon: <FiBookOpen /> },
        { to: `${basePath}/grades`, label: 'Grades', icon: <FiEdit3 /> },
        { to: `${basePath}/progress`, label: 'Progress', icon: <FiTrendingUp /> },
        { to: `${basePath}/upload`, label: 'Data Upload', icon: <FiUploadCloud /> },
      ],
    },
    {
      title: 'Insights',
      items: [
        { to: `${basePath}/insights`, label: 'Honors Insights', icon: <FiBarChart2 />, end: true },
        { to: `${basePath}/categories-summary`, label: 'Categories Summary', icon: <FiCompass /> },
        { to: `${basePath}/insights/student-category-matrix`, label: 'Student Category Records', icon: <FiBarChart2 /> },
        { to: `${basePath}/analytics`, label: 'AI Query System', icon: <FiDatabase /> },
      ],
    },
  ];
  if (isSuperAdminPath) {
    navGroups.push({
      title: 'Admin',
      items: [
        { to: `${basePath}/users`, label: 'Users', icon: <FiSettings /> },
      ],
    });
  }

  // Always append Danger Zone as the final group
  navGroups.push({
    title: 'Maintenance',
    items: [
      { to: `${basePath}/danger`, label: 'Danger Zone', icon: <FiAlertTriangle /> },
    ],
  });

  return (
    <div className="h-screen bg-white">
      <SEO
        title="Admin Console - KL University Exit Portal"
        description="Administrative console for KL University Exit Portal. Manage data and view insights."
        robots="noindex, nofollow"
      />
      {/* Mobile Header */}
      <header className="lg:hidden navbar-maroon shadow-sm border-b sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="navbar-title text-white">KL University Exit Portal</h1>
                <p className="text-xs text-white/80">{user?.name}</p>
              </div>
            </div>
            <button
              onClick={async () => { await logout(); navigate('/login'); }}
              className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-t bg-white">
            <nav className="px-4 py-3 space-y-4">
              {navGroups.map((group) => (
                <AccordionGroup key={group.title} title={group.title}>
                  {group.items.map((item) => (
                    <NavItem 
                      key={item.to}
                      to={item.to} 
                      label={item.label} 
                      icon={item.icon}
                      end={item.end}
                    />
                  ))}
                </AccordionGroup>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Desktop Layout */}
      <div className="hidden lg:flex relative h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            initial={{ width: 72, opacity: 0 }}
            animate={{ width: sidebarHover ? 256 : 72, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="sticky top-0 h-screen shrink-0 bg-[#681a1a] text-white border-r border-[#3b0f0f] flex flex-col overflow-hidden"
            onHoverStart={() => setSidebarHover(true)}
            onHoverEnd={() => setSidebarHover(false)}
          >
            {/* Sidebar Header aligned with navbar height; maroon for contrast */}
            <div className="flex items-center justify-between h-16 px-4 bg-[#681a1a] text-white border-b border-[#3b0f0f]">
              <div className="w-8 h-8 rounded-lg bg-white/20 grid place-items-center text-[11px] font-bold tracking-wide">KL</div>
              {sidebarHover && (
                <button
                  type="button"
                  aria-label="Close sidebar"
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-lg text-white hover:bg-white/10"
                >
                  <FiX className="w-5 h-5" />
                </button>
              )}
            </div>
            {/* Nav (white body) */}
            <nav className={`flex-1 ${sidebarHover ? 'px-4' : 'px-0'} py-2 space-y-3 bg-white text-gray-900 overflow-y-auto scrollbar-none`}>
              {navGroups.map((group) => (
                <AccordionGroup key={group.title} title={group.title} defaultOpen={true} variant="light" expanded={sidebarHover}>
                  {group.items.map((item) => (
                    <NavItem 
                      key={item.to}
                      to={item.to} 
                      label={item.label} 
                      icon={item.icon}
                      end={item.end}
                      expanded={sidebarHover}
                    />
                  ))}
                </AccordionGroup>
              ))}
            </nav>
          </motion.aside>
        )}
        </AnimatePresence>

        

        {/* Desktop Content */}
        <main className="flex-1 min-w-0 flex flex-col bg-white h-screen overflow-hidden">
          {/* Top Navbar (Desktop) */}
          <div className="navbar-maroon px-6 h-16 grid grid-cols-3 items-center">
            {/* Left: Sidebar toggle in navbar */}
            <div className="flex items-center gap-3 min-w-0">
              {!sidebarOpen && (
                <button
                  type="button"
                  aria-label="Open sidebar"
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
              {programInfo ? (
                <div className="truncate">
                  <div className="text-sm font-semibold leading-tight text-white truncate">{programInfo.code}</div>
                  <div className="text-xs text-white/80 leading-tight truncate">{programInfo.name}</div>
                </div>
              ) : (
                user?.programName && (
                  <div className="text-sm text-white/90 truncate">{user.programName}</div>
                )
              )}
            </div>
            {/* Center: Title */}
            <div className="text-center">
              <h1 className="navbar-title text-white text-2xl">KL University Exit Portal</h1>
            </div>
            {/* Right: User details + Logout */}
            <div className="justify-self-end flex items-center gap-3">
              <div className="hidden md:flex flex-col items-end text-white/90 leading-snug">
                <div className="flex items-center gap-2 p-4 gap-4">
                  <span className="text-base font-medium">{user?.name}</span>
                  <span className="text-[11px] uppercase tracking-wide bg-white/15 text-white px-2 py-0.5 rounded-md">{roleLabel}</span>
                </div>
              </div>
              <button
                onClick={async () => { await logout(); navigate('/login'); }}
                className="px-4 py-2 rounded-lg border border-white text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                Logout
              </button>
            </div>
          </div>
          <div className="flex-1 p-6 overflow-y-auto overflow-x-auto">
            <Breadcrumbs location={location} user={user} />
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Content */}
      <main className="lg:hidden">
        <div className="p-4">
          <Breadcrumbs location={location} user={user} />
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
