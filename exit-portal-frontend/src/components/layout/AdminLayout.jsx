import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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
      'courses': 'Courses',
      'grades': 'Grades',
      'progress': 'Progress',
      'users': 'Users'
    };
    
    for (let i = 1; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      const label = routeMap[segment] || segment;
      const path = '/' + pathSegments.slice(0, i + 1).join('/');
      breadcrumbs.push({ label, path });
    }
  }
  
  if (breadcrumbs.length === 0) return null;
  
  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-500 mb-4">
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.path}>
          {index > 0 && <span className="mx-2">/</span>}
          <NavLink 
            to={crumb.path}
            className="hover:text-gray-700 transition-colors"
          >
            {crumb.label}
          </NavLink>
        </React.Fragment>
      ))}
    </nav>
  );
};

const NavItem = ({ to, label, end, icon }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
        isActive 
          ? 'bg-blue-50 text-blue-700 border border-blue-200' 
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`
    }
  >
    {icon && <span className="text-lg">{icon}</span>}
    <span>{label}</span>
  </NavLink>
);

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Determine base path and navigation items based on user type and current path
  const isSuperAdminPath = location.pathname.startsWith('/superadmin');
  const basePath = isSuperAdminPath ? '/superadmin' : '/admin';
  
  const baseNavItems = [
    { to: `${basePath}/overview`, label: 'Overview', icon: '📊', end: true },
    { to: `${basePath}/students`, label: 'Students', icon: '👥' },
    { to: `${basePath}/categories`, label: 'Categories', icon: '📂' },
    { to: `${basePath}/courses`, label: 'Courses', icon: '📚' },
    { to: `${basePath}/grades`, label: 'Grades', icon: '📝' },
    { to: `${basePath}/progress`, label: 'Progress', icon: '📈' }
  ];
  
  // Add Users tab only for super admin paths
  const navItems = isSuperAdminPath ? [
    ...baseNavItems,
    { to: `${basePath}/users`, label: 'Users', icon: '⚙️' }
  ] : baseNavItems;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Admin Console</h1>
                <p className="text-xs text-gray-500">{user?.name}</p>
              </div>
            </div>
            <button
              onClick={async () => { await logout(); navigate('/login'); }}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
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
            <nav className="px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <NavItem 
                  key={item.to}
                  to={item.to} 
                  label={item.label} 
                  icon={item.icon}
                  end={item.end}
                />
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Desktop Layout */}
      <div className="hidden lg:flex min-h-screen">
        {/* Desktop Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">
              {user?.userType === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} Console
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Welcome, {user?.name}
            </p>
            {user?.programName && (
              <p className="text-xs text-gray-500 mt-1">{user.programName}</p>
            )}
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => (
              <NavItem 
                key={item.to}
                to={item.to} 
                label={item.label} 
                icon={item.icon}
                end={item.end}
              />
            ))}
          </nav>
          
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={async () => { await logout(); navigate('/login'); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <span className="text-lg">🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Desktop Content */}
        <main className="flex-1 flex flex-col">
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <Breadcrumbs location={location} user={user} />
          </div>
          <div className="flex-1 p-6">
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
