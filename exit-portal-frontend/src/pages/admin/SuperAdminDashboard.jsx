import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';

const SuperAdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [rankings, setRankings] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || user.userType !== 'SUPER_ADMIN') {
      navigate('/login');
      return;
    }
    fetchDashboard();
    fetchProgramsAndRankings();
  }, [user, navigate]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${config.backendUrl}/api/v1/admin/dashboard`, { withCredentials: true });
      setDashboardData(response.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchProgramsAndRankings = async () => {
    setMetaLoading(true);
    try {
      const [progRes, rankRes] = await Promise.all([
        axios.get(`${config.backendUrl}/api/v1/admin/programs`, { withCredentials: true }),
        axios.get(`${config.backendUrl}/api/v1/admin/programs/rank`, { withCredentials: true })
      ]);
      setPrograms(progRes.data || []);
      setRankings(rankRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setMetaLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={fetchDashboard} className="px-4 py-2 bg-red-900 text-white rounded hover:bg-red-800">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/superadmin/users')}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >Manage Admin Users</button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-900 text-white rounded-lg hover:bg-red-800 transition-colors"
              >Logout</button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Students</h3>
            <p className="text-3xl font-bold text-blue-600">{dashboardData?.stats?.totalStudents ?? '-'}</p>
            <p className="text-sm text-gray-500">Total enrolled</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Completed</h3>
            <p className="text-3xl font-bold text-green-600">{dashboardData?.stats?.completedStudents ?? '-'}</p>
            <p className="text-sm text-gray-500">Requirements met</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">In Progress</h3>
            <p className="text-3xl font-bold text-yellow-600">{dashboardData?.stats?.inProgressStudents ?? '-'}</p>
            <p className="text-sm text-gray-500">Working towards completion</p>
          </div>
        </div>

        {/* Top Bottleneck Programs (use rankings worst to best) */}
        {rankings && rankings.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Top Bottleneck Programs</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rankings.slice(0, Math.min(6, rankings.length)).map((r, idx) => (
                <div key={r.programId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">{r.programCode} - {r.programName}</h3>
                    <span className="text-xs text-gray-500">#{idx + 1}</span>
                  </div>
                  <div className="mt-2 text-sm text-gray-700">Completion rate: {(r.completionRate * 100).toFixed(1)}%</div>
                  <div className="text-sm text-gray-700">Completed: {r.completedStudents} / {r.totalStudents}</div>
                  <div className="mt-3 text-right">
                    <button
                      className="px-3 py-1 border rounded hover:bg-gray-50"
                      onClick={() => navigate(`/superadmin/overview?programId=${r.programId}`)}
                    >View Program</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Program Selector */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Program</label>
              <select
                className="w-full border rounded px-3 py-2"
                onChange={(e) => {
                  const id = e.target.value;
                  if (id) navigate(`/superadmin/overview?programId=${id}`);
                }}
                defaultValue=""
              >
                <option value="">-- Choose a program --</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                ))}
              </select>
            </div>
            {metaLoading && <div className="text-sm text-gray-500">Loading programs...</div>}
          </div>
        </div>

        {/* Program Rankings */}
        {rankings && rankings.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Program Rankings (Worst to Best)</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion Rate</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rankings.map((r) => (
                    <tr key={r.programId}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{r.programCode} - {r.programName}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{r.totalStudents}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{r.completedStudents}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{(r.completionRate * 100).toFixed(1)}%</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                        <button
                          className="px-3 py-1 border rounded hover:bg-gray-50"
                          onClick={() => navigate(`/superadmin/overview?programId=${r.programId}`)}
                        >View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SuperAdminDashboard;
