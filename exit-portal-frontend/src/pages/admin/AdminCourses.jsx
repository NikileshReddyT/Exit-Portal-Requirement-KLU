import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import DataTable from '../../components/admin/DataTable';

const AdminCourses = () => {
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
        if (user?.userType === 'SUPER_ADMIN' && programId) {
          params.append('programId', String(programId));
        } else if (user?.userType === 'ADMIN' && user?.programId) {
          params.append('programId', String(user.programId));
        }

        // Fetch courses and mappings to derive category names per course
        const baseCourses = `${config.backendUrl}/api/v1/admin/data/courses`;
        const baseMappings = `${config.backendUrl}/api/v1/admin/data/mappings`;
        const qs = params.toString();
        const [coursesRes, mappingsRes] = await Promise.all([
          axios.get(qs ? `${baseCourses}?${qs}` : baseCourses, { withCredentials: true }),
          axios.get(qs ? `${baseMappings}?${qs}` : baseMappings, { withCredentials: true }),
        ]);

        const courses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
        const mappings = Array.isArray(mappingsRes.data) ? mappingsRes.data : [];

        const categoriesByCourse = mappings.reduce((acc, m) => {
          const code = m?.courseCode;
          const cat = m?.categoryName;
          if (!code || !cat) return acc;
          if (!acc[code]) acc[code] = new Set();
          acc[code].add(String(cat));
          return acc;
        }, {});

        const enriched = courses.map(c => {
          const code = c?.courseCode || c?.code || c?.id;
          const catSet = code ? categoriesByCourse[String(code)] : undefined;
          const categoryNames = catSet ? Array.from(catSet) : [];
          return { ...c, categoryNames };
        });

        setRows(enriched);
      } catch (e) {
        console.error(e);
        setError('Failed to load courses');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, navigate, programId]);

  

  const handleRowClick = (row) => {
    const code = row.courseCode || row.code || row.CourseCode || row.id;
    if (code) navigate(`/admin/courses/${encodeURIComponent(String(code))}`);
  };

  const columns = [
    { key: 'courseCode', header: 'Course Code', className: 'text-center' },
    { key: 'courseTitle', header: 'Course Title' },
    { key: 'courseCredits', header: 'Credits', className: 'text-center' },
    {
      key: 'categoryNames',
      header: 'Category',
      render: (_val, row) => {
        const list = Array.isArray(row?.categoryNames) ? row.categoryNames : [];
        if (!list.length) return <span className="text-gray-400">—</span>;
        return (
          <div className="flex flex-wrap gap-1 justify-center">
            {list.map((name) => (
              <button
                key={name}
                className="btn inline-flex items-center px-2.5 py-1 rounded-full text-black hover:underline focus:outline-none focus:ring-2 focus:ring-red-300 "
                onClick={(e) => { e.stopPropagation(); navigate(`/admin/categories/${encodeURIComponent(String(name))}`); }}
                title={`View category ${name}`}
              >
                {name}
              </button>
            ))}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Courses</h2>
          <p className="text-sm text-gray-600">Browse courses and drill into completion insights</p>
        </div>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        onRowClick={handleRowClick}
        loading={loading}
        error={error}
        emptyText={loading ? '' : (error || 'No courses found')}
        enableSearch={false}
        enableColumnFilters={false}
      />
    </div>
  );
};

export default AdminCourses;
