import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import DataTable from '../../components/admin/DataTable';

const AdminCategoryDetails = () => {
  const { user } = useAuth();
  const { selectedProgramId } = useProgramContext();
  const navigate = useNavigate();
  const { categoryName } = useParams();

  const [courses, setCourses] = useState([]);
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
        // Load only courses for this category from backend
        const base = `${config.backendUrl}/api/v1/admin/data/courses/by-category`;
        const params = new URLSearchParams();
        params.append('categoryName', String(categoryName));
        if (user?.userType === 'ADMIN' && user?.programId) {
          params.append('programId', String(user.programId));
        } else if (user?.userType === 'SUPER_ADMIN' && selectedProgramId) {
          params.append('programId', String(selectedProgramId));
        }
        const res = await axios.get(`${base}?${params.toString()}`, { withCredentials: true });
        const list = Array.isArray(res.data) ? res.data : [];
        setCourses(list);
      } catch (e) {
        console.error(e);
        setError('Failed to load category details');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, navigate, categoryName]);

  // Navigate to course details on row click
  const handleRowClick = (row) => {
    const code = row?.courseCode || row?.code || row?.CourseCode || row?.id;
    if (code) {
      navigate(`/admin/courses/${encodeURIComponent(String(code))}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Category: {categoryName}</h2>
          <p className="text-sm text-gray-600">Courses and related insights</p>
        </div>
        <button className="px-3 py-2 border rounded" onClick={() => navigate('/admin/categories')}>Back</button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Courses in this category</h3>
        <DataTable 
          rows={courses} 
          onRowClick={handleRowClick}
          cardTitleKey="courseName"
          loading={loading} 
          error={error} 
          emptyText={loading ? '' : (error || 'No courses found')} 
        />
      </div>
    </div>
  );
};

export default AdminCategoryDetails;
