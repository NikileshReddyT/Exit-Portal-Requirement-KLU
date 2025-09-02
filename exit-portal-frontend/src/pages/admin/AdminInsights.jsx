import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import StatCard from '../../components/admin/StatCard';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, Cell } from 'recharts';

const SectionCard = ({ title, children, right }) => (
  <div className="bg-white rounded-lg shadow p-4 sm:p-6">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {right}
    </div>
    {children}
  </div>
);

const ProgressBar = ({ value, className = '' }) => (
  <div className={`w-full h-2 bg-gray-200 rounded ${className}`}>
    <div className="h-2 bg-blue-600 rounded" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

// Mini horizontal bar chart for category met% (compact, professional)
const CategoryMiniBarChart = ({ data = [], height = 220 }) => {
  const sorted = [...data]
    .map((c) => ({ name: c.category, value: Math.round(Math.max(0, Math.min(1, c.metRate ?? 0)) * 100), rate: c.metRate ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const color = (r) => `hsl(${Math.max(0, Math.min(120, Math.round(r * 120)))}, 70%, 45%)`;
  const tf = (s) => (s && s.length > 18 ? `${s.slice(0, 18)}…` : s);
  const rowH = 26;
  const innerHeight = Math.max(160, Math.min(380, sorted.length * rowH + 40));
  return (
    <div className="w-full" style={{ height: height ?? innerHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical" margin={{ top: 6, right: 16, bottom: 6, left: 6 }} barSize={16}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} tickFormatter={tf} />
          <Tooltip formatter={(v) => [`${v}%`, 'Met Rate']} cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
          <Bar dataKey="value" radius={[4, 4, 4, 4]}>
            {sorted.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={color(entry.rate)} />
            ))}
            <LabelList dataKey="value" position="right" formatter={(v) => `${v}%`} className="fill-gray-700 text-[10px]" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const AdminInsights = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedProgramId, programInfo, setProgramContext } = useProgramContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [stats, setStats] = useState(null);
  const [programRanks, setProgramRanks] = useState([]);

  // Program scoping: from context or URL
  const urlParams = new URLSearchParams(location.search);
  const urlProgramId = urlParams.get('programId');
  const programId = selectedProgramId || urlProgramId;

  const basePath = location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';
  const isSuperAdmin = user?.userType === 'SUPER_ADMIN';

  const completionPct = useMemo(() => {
    if (!dashboard?.stats) return 0;
    const total = dashboard.stats.totalStudents || 0;
    const completed = dashboard.stats.completedStudents || 0;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }, [dashboard]);

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) {
      navigate('/login');
      return;
    }

    let isCancelled = false;

    const load = async () => {
      try {
        setLoading(true);

        // Build URLs
        const params = new URLSearchParams();
        if (isSuperAdmin && programId) params.set('programId', programId);
        const query = params.toString();

        const dashUrl = `${config.backendUrl}/api/v1/admin/dashboard${query ? `?${query}` : ''}`;
        const statsUrl = `${config.backendUrl}/api/v1/admin/stats${query ? `?${query}` : ''}`;

        const [dashRes, statsRes] = await Promise.all([
          axios.get(dashUrl, { withCredentials: true }),
          axios.get(statsUrl, { withCredentials: true }),
        ]);

        if (isCancelled) return;
        setDashboard(dashRes.data || {});
        setStats(statsRes.data || {});

        // Ensure program context loaded when scoped
        const effectiveProgramId = isSuperAdmin ? (programId || null) : (user?.programId || null);
        if (effectiveProgramId && (!programInfo || programInfo.programId != effectiveProgramId)) {
          try {
            const programRes = await axios.get(`${config.backendUrl}/api/v1/admin/programs/${effectiveProgramId}`, { withCredentials: true });
            if (!isCancelled) setProgramContext(effectiveProgramId, programRes.data);
          } catch {}
        }

        // Only SUPER_ADMIN sees cross-program ranks
        if (isSuperAdmin) {
          try {
            const rankRes = await axios.get(`${config.backendUrl}/api/v1/admin/programs/rank?limit=5&worstFirst=false`, { withCredentials: true });
            if (!isCancelled) setProgramRanks(rankRes.data || []);
          } catch {}
        }
      } catch (e) {
        if (!isCancelled) {
          console.error(e);
          setError('Failed to load insights');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    load();
    return () => { isCancelled = true; };
  }, [user, programId, isSuperAdmin, navigate, programInfo, setProgramContext]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-900 mx-auto" />
          <p className="mt-4 text-gray-600">Loading insights...</p>
        </div>
      </div>
    );
  }
  if (error) {
    return <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">{error}</div>;
  }

  const catSummaries = Array.isArray(dashboard?.categorySummaries) ? dashboard.categorySummaries : [];
  const topCats = [...catSummaries].sort((a,b) => (b.metRate ?? 0) - (a.metRate ?? 0)).slice(0, 5);
  const bottomCats = [...catSummaries].sort((a,b) => (a.metRate ?? 0) - (b.metRate ?? 0)).slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Insights Overview</h2>
        <p className="text-sm text-gray-600">Actionable snapshot{programInfo ? ` for ${programInfo.code}` : ''}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 items-stretch">
        <StatCard title="Students" value={dashboard?.stats?.totalStudents} color="blue" subtitle="Total" />
        <StatCard title="Completed" value={dashboard?.stats?.completedStudents} color="green" subtitle="Met all categories" />
        <StatCard title="In Progress" value={dashboard?.stats?.inProgressStudents} color="yellow" subtitle="Still working" />
        <StatCard title="Courses" value={stats?.totalCourses} color="purple" subtitle="Catalog" />
      </div>

      {/* Completion snapshot */}
      <SectionCard title="Program Completion Snapshot" right={
        <button
          className="text-sm text-blue-700 hover:underline"
          onClick={() => navigate(`${basePath}/progress${programId ? `?programId=${programId}` : ''}`)}
        >
          View Progress »
        </button>
      }>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-700">Completion Rate</div>
              <div className="text-sm font-medium text-gray-900">{completionPct}%</div>
            </div>
            <ProgressBar value={completionPct} />
            <div className="mt-3 grid grid-cols-2 text-sm">
              <div className="text-gray-600">Completed</div>
              <div className="text-right text-gray-900">{dashboard?.stats?.completedStudents || 0}</div>
              <div className="text-gray-600">In Progress</div>
              <div className="text-right text-gray-900">{dashboard?.stats?.inProgressStudents || 0}</div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Categories</span>
              <span className="font-medium text-gray-900">{stats?.totalCategories ?? '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Courses</span>
              <span className="font-medium text-gray-900">{stats?.totalCourses ?? '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Grades</span>
              <span className="font-medium text-gray-900">{stats?.totalGrades ?? '-'}</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Category performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Top Categories by Met %" right={<button className="text-sm text-blue-700 hover:underline" onClick={() => navigate(`${basePath}/categories-summary${programId ? `?programId=${programId}` : ''}`)}>View All »</button>}>
          {topCats.length === 0 ? (
            <div className="text-sm text-gray-500">No data</div>
          ) : (
            <CategoryMiniBarChart data={topCats} />
          )}
        </SectionCard>

        <SectionCard title="Bottleneck Categories" right={<button className="text-sm text-blue-700 hover:underline" onClick={() => navigate(`${basePath}/categories-summary${programId ? `?programId=${programId}` : ''}`)}>Investigate »</button>}>
          {(dashboard?.bottlenecks || bottomCats).length === 0 ? (
            <div className="text-sm text-gray-500">No data</div>
          ) : (
            <CategoryMiniBarChart data={(dashboard?.bottlenecks || bottomCats)} />
          )}
        </SectionCard>
      </div>

      {/* Quick drilldowns */}
      <SectionCard title="Quick Drilldowns">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <button onClick={() => navigate(`${basePath}/grades${programId ? `?programId=${programId}` : ''}`)} className="px-4 py-2.5 bg-white border rounded-lg hover:bg-gray-50 shadow-sm text-sm">Explore Grades</button>
          <button onClick={() => navigate(`${basePath}/progress${programId ? `?programId=${programId}` : ''}`)} className="px-4 py-2.5 bg-white border rounded-lg hover:bg-gray-50 shadow-sm text-sm">Explore Progress</button>
          <button onClick={() => navigate(`${basePath}/students${programId ? `?programId=${programId}` : ''}`)} className="px-4 py-2.5 bg-white border rounded-lg hover:bg-gray-50 shadow-sm text-sm">Students</button>
          <button onClick={() => navigate(`${basePath}/categories${programId ? `?programId=${programId}` : ''}`)} className="px-4 py-2.5 bg-white border rounded-lg hover:bg-gray-50 shadow-sm text-sm">Categories</button>
          <button onClick={() => navigate(`${basePath}/courses${programId ? `?programId=${programId}` : ''}`)} className="px-4 py-2.5 bg-white border rounded-lg hover:bg-gray-50 shadow-sm text-sm">Courses</button>
          <button onClick={() => navigate(`${basePath}/categories-summary${programId ? `?programId=${programId}` : ''}`)} className="px-4 py-2.5 bg-white border rounded-lg hover:bg-gray-50 shadow-sm text-sm">Categories Summary</button>
        </div>
      </SectionCard>

      {/* Program rankings for Super Admin */}
      {isSuperAdmin && (
        <SectionCard title="Top Programs by Completion">
          {programRanks.length === 0 ? (
            <div className="text-sm text-gray-500">No data</div>
          ) : (
            <div className="space-y-3">
              {programRanks.map((p) => (
                <div key={p.programId} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900">{p.programCode} — {p.programName}</div>
                    <div className="text-sm text-gray-700">{Math.round((p.completionRate || 0) * 100)}%</div>
                  </div>
                  <ProgressBar value={Math.round((p.completionRate || 0) * 100)} className="mt-2" />
                  <div className="mt-1 text-xs text-gray-600">Completed {p.completedStudents}/{p.totalStudents}</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
};

export default AdminInsights;
