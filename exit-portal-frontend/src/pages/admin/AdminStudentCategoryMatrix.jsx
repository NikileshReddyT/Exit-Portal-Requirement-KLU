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
  // Pagination state
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  // Search: input vs debounced term used for server fetch (mirror of AdminStudents debounce style)
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search to prevent refetch on every keystroke
  useEffect(() => {
    const h = setTimeout(() => {
      setPage(0);
      setDebouncedSearch((searchInput || '').trim());
    }, 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

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
        let url = `${config.backendUrl}/api/v1/admin/insights/student-category-matrix/paged?page=${encodeURIComponent(String(page))}&size=${encodeURIComponent(String(size))}`;
        if (effectiveProgramId) url += `&programId=${encodeURIComponent(String(effectiveProgramId))}`;
        if (debouncedSearch) url += `&q=${encodeURIComponent(debouncedSearch)}`;
        const res = await axios.get(url, { withCredentials: true });
        if (cancelled) return;
        const payload = res.data || { categories: [], rows: [] };
        // categories: [string], rows: [{ studentId, studentName, cells: { [categoryName]: { completedCourses, minRequiredCourses, completedCredits, minRequiredCredits } } }]
        setMatrix({
          categories: Array.isArray(payload.categories) ? payload.categories : [],
          rows: Array.isArray(payload.rows) ? payload.rows : [],
        });
        // pagination meta
        setTotalPages(typeof payload.totalPages === 'number' ? payload.totalPages : 0);
        setTotalElements(typeof payload.totalElements === 'number' ? payload.totalElements : 0);
        setHasNext(Boolean(payload.hasNext));
        setHasPrevious(Boolean(payload.hasPrevious));
      } catch (e) {
        if (!cancelled) setError('Failed to load student-category matrix');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, programId, page, size, debouncedSearch]);

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

  // Note: do not return a full-screen loader here; keep table mounted to preserve input focus

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
        <div className="flex items-center gap-3">
          <Toggle value={mode} onChange={setMode} />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        emptyText="No records found"
        exportFileName="student_category_records"
        cardTitleKey="studentId"
        serverSide={true}
        page={page}
        size={size}
        totalPages={totalPages}
        totalElements={totalElements}
        onPageChange={(p) => setPage(p)}
        onSizeChange={(val) => { setPage(0); setSize(val); }}
        defaultSearch={searchInput}
        onSearchChange={(val) => { setSearchInput(val); }}
        exportAllFetcher={async () => {
          // Fetch all pages server-side and map to table rows according to current mode and categories
          const effectiveProgramId = getEffectiveProgramId();
          const exportSize = 1000;
          let pageIdx = 0;
          const allRows = [];
          const cats = Array.isArray(matrix.categories) ? [...matrix.categories] : [];
          while (true) {
            let url = `${config.backendUrl}/api/v1/admin/insights/student-category-matrix/paged?page=${encodeURIComponent(String(pageIdx))}&size=${encodeURIComponent(String(exportSize))}`;
            if (effectiveProgramId) url += `&programId=${encodeURIComponent(String(effectiveProgramId))}`;
            if (debouncedSearch) url += `&q=${encodeURIComponent(debouncedSearch)}`;
            const res = await axios.get(url, { withCredentials: true });
            const payload = res.data || { categories: [], rows: [] };
            const rowsPage = Array.isArray(payload.rows) ? payload.rows : [];
            for (const r of rowsPage) {
              const rowObj = { studentId: r.studentId, studentName: r.studentName };
              cats.forEach((cat) => {
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
              allRows.push(rowObj);
            }
            if (!payload.hasNext) break;
            pageIdx += 1;
          }
          return allRows;
        }}
      />
    </div>
  );
}
;

export default AdminStudentCategoryMatrix;
