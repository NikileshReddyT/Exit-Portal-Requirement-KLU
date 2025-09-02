import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/admin/DataTable';
import { FiUsers, FiTrendingUp } from 'react-icons/fi';

const AdminCourseDetails = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { courseCode } = useParams();

  const [courseRows, setCourseRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) {
      navigate('/login');
      return;
    }
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const base = `${config.backendUrl}/api/v1/admin/data/courses`;
        const params = new URLSearchParams();
        if (user?.userType === 'ADMIN' && user?.programId) params.append('programId', String(user.programId));
        const url = params.toString() ? `${base}?${params}` : base;
        const res = await axios.get(url, { withCredentials: true });
        const list = Array.isArray(res.data) ? res.data : [];
        const filtered = list.filter(c => String(c.courseCode || c.code || c.id).toLowerCase() === String(courseCode).toLowerCase());
        setCourseRows(filtered.length ? filtered : list);
      } catch (e) {
        console.error(e);
        setError('Failed to load course details');
      } finally {
        setLoading(false);
      }
    };
    const loadStats = async () => {
      try {
        setStatsLoading(true);
        setStatsError('');
        const base = `${config.backendUrl}/api/v1/admin/data/courses/${encodeURIComponent(courseCode)}/stats`;
        const params = new URLSearchParams();
        if (user?.userType === 'ADMIN' && user?.programId) params.append('programId', String(user.programId));
        const url = params.toString() ? `${base}?${params}` : base;
        const res = await axios.get(url, { withCredentials: true });
        setStats(res.data || null);
      } catch (e) {
        console.error(e);
        setStatsError('Failed to load course stats');
      } finally {
        setStatsLoading(false);
      }
    };
    load();
    loadStats();
  }, [user, navigate, courseCode]);

  const GradeBarList = ({ title, items, itemKey = 'grade' }) => {
    const data = Array.isArray(items) ? items : [];
    const total = data.reduce((s, it) => s + Number(it.count || 0), 0);
    const max = data.reduce((m, it) => Math.max(m, Number(it.count || 0)), 0);
    const fmtPct = (n) => total > 0 ? ((n * 100) / total).toFixed(1) + '%' : '0%';
    const sorted = [...data].sort((a,b) => Number(b.count||0) - Number(a.count||0));
    return (
      <div className="bg-white rounded-lg shadow p-4 border border-red-100">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-red-900">{title}</h4>
          <span className="text-sm text-gray-500">Total: {total}</span>
        </div>
        {sorted.length === 0 ? (
          <p className="text-sm text-gray-500">No data</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((it) => {
              const label = String(it[itemKey] ?? 'NA');
              const cnt = Number(it.count || 0);
              const width = max > 0 ? Math.max(4, Math.round((cnt / max) * 100)) : 0;
              return (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-12 text-xs font-medium text-gray-700 text-right">{label}</div>
                  <div className="flex-1">
                    <div className="h-3 bg-gray-100 rounded">
                      <div className="h-3 bg-red-500 rounded" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                  <div className="w-28 text-xs text-gray-600 text-right">
                    {cnt} • {fmtPct(cnt)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Course: {courseCode}</h2>
          <p className="text-sm text-gray-600">Course information and related data</p>
        </div>
        <button className="px-3 py-2 border rounded" onClick={() => navigate('/admin/courses')}>Back</button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Course Info</h3>
        <DataTable rows={courseRows} loading={loading} error={error} emptyText={loading ? '' : (error || 'No course data found')} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FiTrendingUp className="h-5 w-5 text-red-600" />
            <h3 className="text-lg font-semibold text-gray-900">Course Stats</h3>
          </div>
          {statsLoading && <span className="text-sm text-gray-500">Loading…</span>}
          {statsError && <span className="text-sm text-red-600">{statsError}</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-red-50 rounded-lg shadow p-4 flex flex-col justify-center items-center border border-red-100">
            <div className="flex items-center gap-2 text-sm text-red-700">
              <FiUsers className="h-4 w-4" />
              <span>Registered Students</span>
            </div>
            <div className="text-3xl font-bold text-red-900">{stats?.registeredCount ?? (statsLoading ? '—' : 0)}</div>
          </div>
          <GradeBarList title="Grade Distribution" items={stats?.gradeCounts} itemKey="grade" />
          <GradeBarList title="Promotion Distribution" items={stats?.promotionCounts} itemKey="promotion" />
        </div>
      </div>
    </div>
  );
};

export default AdminCourseDetails;
