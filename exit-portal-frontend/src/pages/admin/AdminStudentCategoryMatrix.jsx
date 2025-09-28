import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProgramContext } from '../../context/ProgramContext';
import DataTable from '../../components/admin/DataTable';

const Toggle = ({ value, onChange }) => {
  return (
    <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
      <button
        className={`btn px-3 py-1 text-sm ${value === 'courses' ? 'bg-red-50 text-red-800 font-semibold' : 'bg-white text-gray-700'}`}
        onClick={() => onChange('courses')}
      >
        Courses
      </button>
      <button
        className={`btn px-3 py-1 text-sm border-l border-gray-200 ${value === 'credits' ? 'bg-red-50 text-red-800 font-semibold' : 'bg-white text-gray-700'}`}
        onClick={() => onChange('credits')}
      >
        Credits
      </button>
    </div>
  );
};

const AdminStudentCategoryMatrix = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedProgramId, programInfo } = useProgramContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matrix, setMatrix] = useState({ categories: [], rows: [] });
  const [mode, setMode] = useState('courses'); // 'courses' | 'credits'

  // Determine effective programId like other admin pages
  const urlParams = new URLSearchParams(location.search);
  const urlProgramId = urlParams.get('programId');
  const programId = (user?.userType === 'ADMIN' && user?.programId)
    ? String(user.programId)
    : (selectedProgramId || urlProgramId);

  const getEffectiveProgramId = () => {
    if (user?.userType === 'SUPER_ADMIN' && programId) return programId;
    if (user?.userType === 'ADMIN' && user?.programId) return user.programId;
    return null;
  };

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) {
      navigate('/login');
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const effectiveProgramId = getEffectiveProgramId();
        let url = `${config.backendUrl}/api/v1/admin/insights/student-category-matrix`;
        if (effectiveProgramId) url += `?programId=${encodeURIComponent(String(effectiveProgramId))}`;
        const res = await axios.get(url, { withCredentials: true });
        if (cancelled) return;
        const payload = res.data || { categories: [], rows: [] };
        // categories: [string], rows: [{ studentId, studentName, cells: { [categoryName]: { completedCourses, minRequiredCourses, completedCredits, minRequiredCredits } } }]
        setMatrix({
          categories: Array.isArray(payload.categories) ? payload.categories : [],
          rows: Array.isArray(payload.rows) ? payload.rows : [],
        });
      } catch (e) {
        if (!cancelled) setError('Failed to load student-category matrix');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, programId]);

  const headerProgramCode = programInfo?.code || null;

  // Build DataTable columns and rows from matrix payload
  const columns = useMemo(() => {
    const base = [
      { key: 'studentId', header: 'Student ID', width: 'min-w-[140px]', className: 'text-center' },
      { key: 'studentName', header: 'Student Name', width: 'min-w-[200px]', className: 'text-left' },
    ];
    const dynamic = (matrix.categories || []).map((cat) => ({ key: cat, header: cat, width: 'min-w-[140px]', className: 'text-center' }));
    return [...base, ...dynamic];
  }, [matrix.categories]);

  const rows = useMemo(() => {
    const arr = Array.isArray(matrix.rows) ? matrix.rows : [];
    return arr.map((r) => {
      const rowObj = { studentId: r.studentId, studentName: r.studentName };
      (matrix.categories || []).forEach((cat) => {
        const cell = r?.cells?.[cat];
        if (!cell) {
          rowObj[cat] = '';
        } else if (mode === 'courses') {
          const a = cell.completedCourses ?? 0;
          const b = cell.minRequiredCourses ?? 0;
          rowObj[cat] = `${a}/${b}`;
        } else {
          const a = Math.round((cell.completedCredits ?? 0) * 10) / 10;
          const b = Math.round((cell.minRequiredCredits ?? 0) * 10) / 10;
          rowObj[cat] = `${a}/${b}`;
        }
      });
      return rowObj;
    });
  }, [matrix.rows, matrix.categories, mode]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-900 mx-auto" />
          <p className="mt-4 text-gray-600">Loading matrix...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{headerProgramCode ? `${headerProgramCode} - Student Category Records` : 'Student Category Records'}</h2>
          <p className="text-sm text-gray-600">Per-student completion vs minimums across all categories for the selected program.</p>
        </div>
        <Toggle value={mode} onChange={setMode} />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={false}
        error={error}
        emptyText="No records found"
        exportFileName="student_category_records"
        cardTitleKey="studentId"
      />
    </div>
  );
}
;

export default AdminStudentCategoryMatrix;
