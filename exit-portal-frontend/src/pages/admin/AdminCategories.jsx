import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import DataTable from '../../components/admin/DataTable';

const AdminCategories = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedProgramId } = useProgramContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  
  // Get programId from URL params or context
  const urlParams = new URLSearchParams(location.search);
  const urlProgramId = urlParams.get('programId');
  const programId = selectedProgramId || urlProgramId;

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) {
      navigate('/login');
      return;
    }
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const params = new URLSearchParams();
        // For SUPER_ADMIN, use programId from context/URL if available
        // For ADMIN, always use their assigned program
        if (user?.userType === 'SUPER_ADMIN' && programId) {
          params.append('programId', String(programId));
        } else if (user?.userType === 'ADMIN' && user?.programId) {
          params.append('programId', String(user.programId));
        }

        const qs = params.toString();
        const baseCategories = `${config.backendUrl}/api/v1/admin/data/categories`;
        const baseRequirements = `${config.backendUrl}/api/v1/admin/data/requirements`;
        const [catsRes, reqsRes] = await Promise.all([
          axios.get(qs ? `${baseCategories}?${qs}` : baseCategories, { withCredentials: true }),
          axios.get(qs ? `${baseRequirements}?${qs}` : baseRequirements, { withCredentials: true }),
        ]);

        const categories = Array.isArray(catsRes.data) ? catsRes.data : [];
        const requirements = Array.isArray(reqsRes.data) ? reqsRes.data : [];
        const reqByName = requirements.reduce((acc, r) => {
          const name = r?.categoryName;
          if (name) acc[String(name)] = { minCourses: r?.minCourses, minCredits: r?.minCredits };
          return acc;
        }, {});

        const merged = categories.map(c => {
          const name = c?.categoryName || c?.name;
          const req = name ? reqByName[String(name)] : undefined;
          return {
            ...c,
            categoryName: name,
            minCourses: req?.minCourses ?? null,
            minCredits: req?.minCredits ?? null,
          };
        });

        setRows(merged);
      } catch (e) {
        console.error(e);
        setError('Failed to load categories');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, navigate, programId]);

  

  const handleRowClick = (row) => {
    const name = row.categoryName || row.category || row.name;
    if (name) navigate(`/admin/categories/${encodeURIComponent(String(name))}`);
  };

  const columns = [
    {
      key: 'categoryName',
      header: 'Category',
      render: (val) => (
        <button
          className=" btn inline-flex items-center px-2.5 py-1 rounded-full text-black hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-300"
          onClick={(e) => { e.stopPropagation(); navigate(`/admin/categories/${encodeURIComponent(String(val))}`); }}
          title={`View category ${val}`}
        >
          {val}
        </button>
      ),
    },
    { key: 'minCourses', header: 'Min Courses', className: 'text-center' },
    { key: 'minCredits', header: 'Min Credits', className: 'text-center' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Categories</h2>
          <p className="text-sm text-gray-600">Browse categories and drill into courses and outcomes</p>
        </div>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        onRowClick={handleRowClick}
        loading={loading}
        error={error}
        emptyText={loading ? '' : (error || 'No categories found')}
        enableSearch={false}
        enableColumnFilters={false}
      />
    </div>
  );
};

export default AdminCategories;
