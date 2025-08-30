import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/admin/DataTable';

const AdminCourseDetails = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { courseCode } = useParams();

  const [courseRows, setCourseRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    load();
  }, [user, navigate, courseCode]);

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
    </div>
  );
};

export default AdminCourseDetails;
