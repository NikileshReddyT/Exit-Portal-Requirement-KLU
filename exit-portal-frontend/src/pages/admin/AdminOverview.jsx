import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import { FiTrendingDown, FiUsers, FiAlertTriangle, FiAward, FiTarget, FiChevronDown } from 'react-icons/fi';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, Legend, Rectangle } from 'recharts';

// Reusable quick link button
const QuickLink = ({ to, label, onClick }) => (
  <button onClick={onClick} className="btn px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 shadow-sm">
    {label}
  </button>
);

// Professional, easy-to-read horizontal bar chart (0-100%)
const CategoryPerformanceChart = ({ data = [], onBarClick = () => {} }) => {
  const sorted = [...data]
    .map((c) => ({ name: c.category, value: Math.round(Math.max(0, Math.min(1, c.metRate ?? 0)) * 100) }))
    .sort((a, b) => b.value - a.value);
  const tf = (s) => (s && s.length > 26 ? `${s.slice(0, 26)}…` : s);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const rowH = isMobile ? 24 : 26;
  const innerHeight = Math.max(220, Math.min(900, sorted.length * rowH + 64));

  return (
    <div className="w-full">
      <div style={{ height: innerHeight, minWidth: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sorted} layout="vertical" margin={{ top: 12, right: (isMobile ? 64 : 84), bottom: 12, left: 12 }} barSize={isMobile ? 10 : 12}>
            <CartesianGrid horizontal={false} stroke="rgba(15,23,42,0.06)" />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={isMobile ? 170 : 260} axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: isMobile ? 11 : 12 }} tickFormatter={tf} />
            <Tooltip formatter={(v) => [`${v}%`, 'Met rate']} cursor={{ fill: 'rgba(2,6,23,0.04)' }} contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, color: '#0f172a' }} labelStyle={{ color: '#334155' }} itemStyle={{ color: '#0f172a' }} />
            <Bar dataKey="value" name="Met rate" fill="#16a34a" background={{ fill: '#f1f5f9', radius: [8, 8, 8, 8] }} radius={[8, 8, 8, 8]}
              onClick={(data, index) => { const name = data?.payload?.name || (sorted[index]?.name); if (name) onBarClick(name); }}>
              <LabelList dataKey="value" position="right" offset={isMobile ? 4 : 8} formatter={(v) => `${v}%`} fill="#0f172a" fontSize={isMobile ? 10 : 11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Stacked bar chart showing actual vs additional projected met rate
const CategoryPerformanceStackedChart = ({ data = [], onBarClick = () => {} }) => {
  const sorted = [...data]
    .map((c) => {
      const rateA = Math.max(0, Math.min(1, c.metRateActual ?? 0));
      const rateP = Math.max(0, Math.min(1, c.metRateProjected ?? 0));
      const add = Math.max(0, rateP - rateA);
      return {
        name: c.category,
        actual: Math.round(rateA * 100),
        projectedExtra: Math.round(add * 100),
      };
    })
    .sort((a, b) => (b.actual + b.projectedExtra) - (a.actual + a.projectedExtra));
  const tf = (s) => (s && s.length > 26 ? `${s.slice(0, 26)}…` : s);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const rowH = isMobile ? 24 : 26;
  const innerHeight = Math.max(220, Math.min(900, sorted.length * rowH + 64));

  // Smart label renderers for readability
  const ActualLabel = (props) => {
    const { x, y, width, height, value } = props;
    if (!value || value <= 0) return null;
    const text = `${value}%`;
    const pad = 6;
    const minInside = 28;
    const isInside = width >= minInside;
    const tx = isInside ? x + width - pad : x + width + pad;
    const anchor = isInside ? 'end' : 'start';
    const fill = isInside ? '#ffffff' : '#065f46'; // white inside green, dark green outside
    return (
      <text x={tx} y={y + height / 2} dy={4} textAnchor={anchor} fill={fill} fontSize={11} fontWeight={600}>
        {text}
      </text>
    );
  };

  const ProjectedLabel = (props) => {
    const { x, y, width, height, value } = props;
    if (!value || value <= 0) return null;
    const text = `+${value}%`;
    const pad = 6;
    const minInside = 34;
    const isInside = width >= minInside;
    const tx = isInside ? x + width - pad : x + width + pad;
    const anchor = isInside ? 'end' : 'start';
    const fill = isInside ? '#ffffff' : '#1e3a8a'; // white on blue, dark blue outside
    return (
      <text x={tx} y={y + height / 2} dy={4} textAnchor={anchor} fill={fill} fontSize={11} fontWeight={600}>
        {text}
      </text>
    );
  };

  // Rounded corners: round only the outer edges of the stacked bar; if only one segment exists, round both
  const actualShape = (props) => {
    const proj = props?.payload?.projectedExtra || 0;
    const radius = proj > 0 ? [9, 0, 0, 9] : [9, 9, 9, 9];
    return <Rectangle {...props} radius={radius} />;
  };
  const projectedShape = (props) => {
    const act = props?.payload?.actual || 0;
    const radius = act > 0 ? [0, 9, 9, 0] : [9, 9, 9, 9];
    return <Rectangle {...props} radius={radius} />;
  };

  return (
    <div className="w-full">
      <div style={{ height: innerHeight, minWidth: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sorted} layout="vertical" margin={{ top: 12, right: (isMobile ? 64 : 96), bottom: 12, left: 12 }} barSize={isMobile ? 10 : 12}>
            <CartesianGrid horizontal={false} stroke="rgba(15,23,42,0.06)" />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={isMobile ? 170 : 260} axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: isMobile ? 11 : 12 }} tickFormatter={tf} />
            <Tooltip
              formatter={(value, name) => {
                const label = name === 'Actual' ? 'Actual met' : 'Projected gain';
                return [`${value}%`, label];
              }}
              cursor={{ fill: 'rgba(2,6,23,0.04)' }}
              contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, color: '#0f172a' }}
              labelStyle={{ color: '#334155' }}
              itemStyle={{ color: '#0f172a' }}
            />
            <Legend iconType="circle" verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 8 }} />
            <Bar
              name="Actual"
              stackId="a"
              dataKey="actual"
              fill="#16a34a"
              minPointSize={2}
              shape={actualShape}
              onClick={(data, index) => { const name = data?.payload?.name || (sorted[index]?.name); if (name) onBarClick(name); }}
            >
              <LabelList dataKey="actual" content={<ActualLabel />} />
            </Bar>
            <Bar
              name="Projected"
              stackId="a"
              dataKey="projectedExtra"
              fill="#2563eb"
              minPointSize={2}
              shape={projectedShape}
              onClick={(data, index) => { const name = data?.payload?.name || (sorted[index]?.name); if (name) onBarClick(name); }}
            >
              <LabelList dataKey="projectedExtra" content={<ProjectedLabel />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const AdminOverview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedProgramId, programInfo } = useProgramContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState({
    risk: null,
    courseLeaderboard: null,
  });
  const [showCat, setShowCat] = useState(false);
  const [projection, setProjection] = useState(false);
  const [catProjected, setCatProjected] = useState([]);
  
  // Use program context or URL params
  const urlParams = new URLSearchParams(location.search);
  const urlProgramId = urlParams.get('programId');
  // For ADMIN, ignore ProgramContext selections and force their assigned programId
  const programId = (user?.userType === 'ADMIN' && user?.programId)
    ? String(user.programId)
    : (selectedProgramId || urlProgramId);
  const urlProgramCode = urlParams.get('programCode');
  const programCode = programInfo?.code || urlProgramCode || null;

  const getEffectiveProgramId = () => {
    if (user?.userType === 'SUPER_ADMIN' && programId) return programId;
    if (user?.userType === 'ADMIN' && user?.programId) return user.programId;
    return null;
  };

  const handleCategoryBarClick = (categoryName) => {
    const base = location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';
    const effectiveProgramId = getEffectiveProgramId();
    const params = new URLSearchParams();
    if (effectiveProgramId) params.set('programId', String(effectiveProgramId));
    if (projection) params.set('project', 'true');
    const qp = params.toString() ? `?${params.toString()}` : '';
    navigate(`${base}/categories-summary/${encodeURIComponent(categoryName)}/completion${qp}`);
  };


  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) {
      navigate('/login');
      return;
    }
    
    let isCancelled = false;
    
    const load = async () => {
      try {
        setLoading(true);
        // Build API URL with programId
        let apiUrl = `${config.backendUrl}/api/v1/admin/dashboard`;
        
        // For SUPER_ADMIN, use programId from context/URL if available
        // For ADMIN, always use their assigned program
        let effectiveProgramId = null;
        if (user?.userType === 'SUPER_ADMIN' && programId) {
          effectiveProgramId = programId;
        } else if (user?.userType === 'ADMIN' && user?.programId) {
          effectiveProgramId = user.programId;
        }
        console.log(programInfo,programId,user,"data")
        
        if (effectiveProgramId) {
          console.log('Effective Program ID:', effectiveProgramId);
  
          apiUrl += `?programId=${effectiveProgramId}`;
        }
        
        
        const res = await axios.get(apiUrl, { withCredentials: true });

        if (isCancelled) return; // Prevent state update if component unmounted or effect cancelled

        const dash = res.data || {};
        setData(dash);

        // Use insights bundled in dashboard; avoid any extra API calls
        const lbRaw = dash?.courseLeaderboard || {};
        const riskRaw = dash?.risk || null;
        setInsights({
          risk: riskRaw,
          courseLeaderboard: { leaders: lbRaw.leaders || [], laggards: lbRaw.laggards || [] },
        });
        
        // No separate program details fetch; dashboard includes programCode/programName when scoped
      } catch (e) {
        if (!isCancelled) {
          console.error(e);
          setError('Failed to load overview');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };
    
    load();
    
    return () => {
      isCancelled = true;
    };
  }, [user, programId]);

  // Load projected category summaries lazily when chart is opened and projection is enabled
  useEffect(() => {
    let cancelled = false;
    const loadProjected = async () => {
      try {
        if (!projection || !showCat) return;
        const effectiveProgramId = getEffectiveProgramId();
        let url = `${config.backendUrl}/api/v1/admin/overview/categories/projected`;
        if (effectiveProgramId) url += `?programId=${encodeURIComponent(String(effectiveProgramId))}`;
        const res = await axios.get(url, { withCredentials: true });
        if (cancelled) return;
        const arr = Array.isArray(res.data) ? res.data : [];
        setCatProjected(arr);
      } catch (e) {
        if (!cancelled) {
          // Non-critical; fallback to normal summaries
          setCatProjected([]);
        }
      }
    };
    loadProjected();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projection, showCat, user, programId]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-900 mx-auto" />
          <p className="mt-4 text-gray-600">Loading overview...</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">{error}</div>
    );
  }

  // Determine base path for navigation
  const basePath = location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';
  const isSuperAdmin = user?.userType === 'SUPER_ADMIN';
  const totalStudents = data?.stats?.totalStudents ?? 0;
  const catSummaries = Array.isArray(data?.categorySummaries) ? data.categorySummaries : [];
  // Prefer backend-resolved programCode; for ADMIN fall back to user's programCode; use ProgramContext last (SUPER_ADMIN)
  const headerProgramCode = data?.programCode || (user?.userType === 'ADMIN' ? user?.programCode : null) || programInfo?.code || null;
  // Stats display (fallback to provided snapshot when API not available)
  const statsDisplay = {
    totalStudents: data?.stats?.totalStudents ?? 293,
    completedStudents: data?.stats?.completedStudents ?? 0,
    inProgressStudents: data?.stats?.inProgressStudents ?? 293,
  };
  
  return (
    <div className="space-y-8 min-h-full">
      {/* Program info is now shown in the navbar (left section). */}
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {headerProgramCode ? `${headerProgramCode} - Overview` : 'Overview'} {totalStudents > 0 && `( ${totalStudents} students )`}
        </h2>
        <p className="text-sm text-gray-600">
          {programInfo ? `Program-specific snapshot and navigation` : `${user?.programName ? user.programName + ' - ' : ''}Program snapshot and quick navigation`}
        </p>
      </div>

      {/* Risk Summary temporarily disabled */}
      {false && insights?.risk && (
        <div className="bg-white rounded-lg shadow p-6">Risk summary hidden</div>
      )}

      {/* Program Stats */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <FiUsers className="h-5 w-5 text-red-700" />
          <h3 className="text-lg font-semibold text-gray-900">Program Stats</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 p-4 bg-gradient-to-br from-gray-50 to-white">
            <div className="text-xs font-medium text-gray-500">Total Students</div>
            <div className="mt-1 text-3xl font-bold text-gray-900">{statsDisplay.totalStudents}</div>
          </div>
          <div className="rounded-xl border border-gray-200 p-4 bg-gradient-to-br from-green-50 to-white">
            <div className="text-xs font-medium text-green-700">Completed Students</div>
            <div className="mt-1 text-3xl font-bold text-green-900">{statsDisplay.completedStudents}</div>
          </div>
          <div className="rounded-xl border border-gray-200 p-4 bg-gradient-to-br from-yellow-50 to-white">
            <div className="text-xs font-medium text-yellow-700">In-Progress Students</div>
            <div className="mt-1 text-3xl font-bold text-yellow-900">{statsDisplay.inProgressStudents}</div>
          </div>
        </div>
      </div>

      {/* Category Completion (Met rate by category) */}
      {catSummaries.length > 0 && (
        <div
          className="bg-red-50 rounded-lg shadow p-4 sm:p-6 border border-red-100 cursor-pointer"
          onClick={() => setShowCat(true)}
          role="button"
          aria-expanded={showCat}
        >
          <div className="flex items-center justify-between mb-2 sm:mb-4 select-none">
            <div className="flex items-center gap-2">
              <FiAward className="h-5 w-5 text-red-600" />
              <h3 className="text-lg font-semibold text-red-900">Category Completion</h3>
            </div>
            <div className="flex items-center gap-3 text-red-700" onClick={(e) => e.stopPropagation()}>
              <label className="inline-flex items-center gap-2 text-xs bg-white border border-red-200 text-red-800 rounded px-2 py-1">
                <input type="checkbox" checked={projection} onChange={(e) => setProjection(e.target.checked)} />
                Projection Mode
              </label>
              {!showCat && (
                <span className="hidden sm:inline text-xs">Click anywhere to open chart</span>
              )}
              <FiChevronDown className={`h-5 w-5 transition-transform ${showCat ? 'rotate-180' : ''}`} />
            </div>
          </div>
          {!showCat && (
            <div className="text-xs sm:text-sm text-red-700/80 bg-red-100/60 border border-red-200 rounded-md px-3 py-2 text-center">
              Click anywhere in this card to open the chart
            </div>
          )}
          {showCat && (
            <div className="mt-3 sm:mt-4" onClick={(e) => e.stopPropagation()}>
              {!projection && (
                <CategoryPerformanceChart data={catSummaries} onBarClick={handleCategoryBarClick} />
              )}
              {projection && (
                <CategoryPerformanceStackedChart data={catProjected} onBarClick={handleCategoryBarClick} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Course Leaderboard */}
      {insights?.courseLeaderboard && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performers */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <FiAward className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Top Performing Courses</h3>
            </div>
            <div className="space-y-3">
              {insights.courseLeaderboard.leaders?.slice(0, 5).map((course, idx) => {
                const code = (course.courseCode || '').toUpperCase();
                const title = course.courseTitle || course.courseName || '';
                const go = () => navigate(`${basePath}/courses/${encodeURIComponent(String(course.courseCode))}${programId ? `?programId=${programId}` : ''}`);
                return (
                                  <div key={course.courseCode} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors cursor-pointer" onClick={go}>
                  <div className="flex-1">
                    <div className="font-semibold text-green-800">{code}</div>
                    {title && <div className="text-sm text-green-700 mt-1">{title}</div>}
                    <div className="text-xs text-gray-600 mt-1">{course.passCnt}/{course.totalCnt} students</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-green-700">{(course.passRate * 100).toFixed(1)}%</div>
                    <div className="text-xs text-gray-500">#{idx + 1}</div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Performers */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <FiTrendingDown className="h-5 w-5 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Courses Needing Attention</h3>
            </div>
            <div className="space-y-3">
              {insights.courseLeaderboard.laggards?.slice(0, 5).map((course, idx) => {
                const code = (course.courseCode || '').toUpperCase();
                const title = course.courseTitle || '';
                const go = () => navigate(`${basePath}/courses/${encodeURIComponent(String(course.courseCode))}${programId ? `?programId=${programId}` : ''}`);
                return (
                  <div key={course.courseCode} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 transition-colors cursor-pointer" onClick={go}>
                    <div className="flex-1">
                      <div className="font-semibold text-red-800">{code}</div>
                      {title && <div className="text-sm text-red-700 mt-1">{title}</div>}
                      <div className="text-xs text-gray-600 mt-1">{course.passCnt}/{course.totalCnt} students</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-red-700">{(course.passRate * 100).toFixed(1)}%</div>
                      <div className="text-xs text-gray-500">#{idx + 1}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      

      {Array.isArray(data?.bottlenecks) && data.bottlenecks.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Attention Required Categories</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.bottlenecks.map((b, idx) => (
              <div key={idx} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-900">{b.category}</div>
                  <span className="text-xs text-gray-500">#{idx + 1}</span>
                </div>
                <div className="mt-2 text-sm text-gray-700">Met rate: {(b.metRate * 100).toFixed(1)}%</div>
                <div className="text-sm text-gray-700">Avg credit completion: {(b.avgCreditCompletion * 100).toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
         <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick actions</h3>
        <div className="-mx-1 overflow-x-auto sm:overflow-visible">
          <div className="px-1 flex gap-2 sm:gap-3 flex-nowrap sm:flex-wrap flex-col md:flex-row">
            <QuickLink label="Students" onClick={() => navigate(`${basePath}/students${programId ? `?programId=${programId}` : ''}`)} />
            <QuickLink label="Categories" onClick={() => navigate(`${basePath}/categories${programId ? `?programId=${programId}` : ''}`)} />
            <QuickLink label="Courses" onClick={() => navigate(`${basePath}/courses${programId ? `?programId=${programId}` : ''}`)} />
            <QuickLink label="Grades" onClick={() => navigate(`${basePath}/grades${programId ? `?programId=${programId}` : ''}`)} />
            <QuickLink label="Progress" onClick={() => navigate(`${basePath}/progress${programId ? `?programId=${programId}` : ''}`)} />
            {isSuperAdmin && (
              <QuickLink label="Admin Users" onClick={() => navigate(`${basePath}/users`)} />
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default AdminOverview;
