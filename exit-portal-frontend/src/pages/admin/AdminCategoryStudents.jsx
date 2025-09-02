import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import DataTable from '../../components/admin/DataTable';

const AdminCategoryStudents = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { categoryName: rawCategory } = useParams();
  const categoryName = decodeURIComponent(rawCategory || '');
  const { selectedProgramId } = useProgramContext();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const urlParams = new URLSearchParams(location.search);
  const urlProgramId = urlParams.get('programId');
  const programId = selectedProgramId || urlProgramId;

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) {
      navigate('/login');
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const base = `${config.backendUrl}/api/v1/admin/data/students/by-category/met`;
        const params = new URLSearchParams();
        params.append('categoryName', categoryName);
        if (user?.userType === 'SUPER_ADMIN' && programId) {
          params.append('programId', String(programId));
        } else if (user?.userType === 'ADMIN' && user?.programId) {
          params.append('programId', String(user.programId));
        }
        const url = `${base}?${params.toString()}`;
        const res = await axios.get(url, { withCredentials: true });
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setRows(list);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError('Failed to load students for category');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (categoryName) load();
    return () => { cancelled = true; };
  }, [user, navigate, programId, categoryName]);

  const columns = useMemo(() => ([
    { key: 'studentId', header: 'Student ID' },
    { key: 'studentName', header: 'Student Name' },
  ]), []);

  const basePath = location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{categoryName} — Students Who Met</h2>
          <p className="text-sm text-gray-600">Students who have satisfied the requirements of this category</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          emptyText={loading ? '' : (error || 'No students found for this category')}
          onRowClick={(row) => {
            const id = row.studentId;
            if (id) {
              const qp = programId ? `?programId=${programId}` : '';
              navigate(`${basePath}/categories-summary/${encodeURIComponent(String(categoryName))}/students/${encodeURIComponent(String(id))}${qp}`);
            }
          }}
          cardTitleKey="studentName"
          enableSearch
          enableColumnFilters
          enableColumnVisibility
          enableExport
          exportFileName={`category-${categoryName}-students`}
        />
      </div>
    </div>
  );
};

export default AdminCategoryStudents;
