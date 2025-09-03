import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import DataTable from '../../components/admin/DataTable';
import { useMemo } from 'react';

const AdminGrades = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { selectedProgramId } = useProgramContext();
  
  // Get programId from URL params or context
  const urlParams = new URLSearchParams(location.search);
  const urlProgramId = urlParams.get('programId');
  const programId = selectedProgramId || urlProgramId;

  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [studentId, setStudentId] = useState('');
  const [category, setCategory] = useState('');

  const load = async (opts = {}) => {
    try {
      setLoading(true);
      setError('');
      const base = `${config.backendUrl}/api/v1/admin/data/grades/paged`;
      const params = new URLSearchParams();
      const sId = opts.studentId ?? studentId;
      const cat = opts.category ?? category;
      const p = opts.page ?? page;
      const sz = opts.size ?? size;
      // For SUPER_ADMIN, use programId from context/URL if available
      // For ADMIN, always use their assigned program
      if (user?.userType === 'SUPER_ADMIN' && programId) {
        params.append('programId', String(programId));
      } else if (user?.userType === 'ADMIN' && user?.programId) {
        params.append('programId', String(user.programId));
      }
      if (sId && sId.trim()) params.append('studentId', sId.trim());
      if (cat && cat.trim()) params.append('category', cat.trim());
      params.append('page', String(p));
      params.append('size', String(sz));
      const res = await axios.get(`${base}?${params.toString()}`, { withCredentials: true });
      const data = res.data || {};
      setRows(Array.isArray(data.content) ? data.content : []);
      setTotalPages(Number.isFinite(data.totalPages) ? data.totalPages : 0);
      setTotalElements(typeof data.totalElements === 'number' ? data.totalElements : 0);
    } catch (e) {
      console.error(e);
      setError('Failed to load grades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) return;
    // Read initial filters from query string
    const sp = new URLSearchParams(location.search);
    const sId = sp.get('studentId') || '';
    const cat = sp.get('category') || '';
    setStudentId(sId);
    setCategory(cat);
    // Load immediately with parsed filters
    load({ studentId: sId, category: cat, page: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.search, programId]);
  const columns = useMemo(() => ([
    { key: 'studentId', header: 'Student ID' },
    { key: 'courseCode', header: 'Course Code' },
    { key: 'courseName', header: 'Course Name' },
    { key: 'credits', header: 'Credits', className: 'text-center' },
    { key: 'grade', header: 'Grade', className: 'text-center' },
    { key: 'gradePoint', header: 'Grade Point', className: 'text-center' },
    { key: 'promotion', header: 'Promotion', className: 'text-center' },
    { key: 'category', header: 'Category', },
    { key: 'year', header: 'Year', className: 'text-center' },
    { key: 'semester', header: 'Semester', className: 'text-center' },
  ]), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Grades</h2>
          <p className="text-sm text-gray-600">Server-side paginated view</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        serverSide
        page={page}
        size={size}
        totalPages={totalPages}
        totalElements={totalElements}
        onPageChange={(p) => { setPage(p); load({ page: p }); }}
        onSizeChange={(val) => { setSize(val); setPage(0); load({ size: val, page: 0 }); }}
        loading={loading}
        error={error}
        emptyText={loading ? '' : (error || 'No grades found')}
        // UI enhancements
        enableSearch={false}
        enableColumnFilters={false}
        enableColumnVisibility
        enableExport
        exportFileName="grades"
      />
    </div>
  );
};

export default AdminGrades;
