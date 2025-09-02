import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import DataTable from '../../components/admin/DataTable';

const AdminStudentCategoryCourses = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { selectedProgramId } = useProgramContext();
  const { categoryName: rawCategory, studentId: rawStudentId } = useParams();
  const categoryName = decodeURIComponent(rawCategory || '');
  const studentIdParam = decodeURIComponent(rawStudentId || '');

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

  const load = async (opts = {}) => {
    try {
      setLoading(true);
      setError('');
      const base = `${config.backendUrl}/api/v1/admin/data/grades/paged`;
      const params = new URLSearchParams();
      const p = opts.page ?? page;
      const sz = opts.size ?? size;

      // Program scoping
      if (user?.userType === 'SUPER_ADMIN' && programId) {
        params.append('programId', String(programId));
      } else if (user?.userType === 'ADMIN' && user?.programId) {
        params.append('programId', String(user.programId));
      }

      // Fixed filters from route
      if (studentIdParam) params.append('studentId', String(studentIdParam));
      if (categoryName) params.append('category', String(categoryName));

      params.append('page', String(p));
      params.append('size', String(sz));

      const res = await axios.get(`${base}?${params.toString()}`, { withCredentials: true });
      const data = res.data || {};
      setRows(Array.isArray(data.content) ? data.content : []);
      setTotalPages(Number.isFinite(data.totalPages) ? data.totalPages : 0);
      setTotalElements(typeof data.totalElements === 'number' ? data.totalElements : 0);
    } catch (e) {
      console.error(e);
      setError('Failed to load courses/grades for this student and category');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) return;
    load({ page: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.search, programId, studentIdParam, categoryName]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{categoryName} — Courses for Student {studentIdParam}</h2>
          <p className="text-sm text-gray-600">Server-side paginated grades filtered by student and category</p>
        </div>
      </div>

      <DataTable
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
        emptyText={loading ? '' : (error || 'No records found')}
        enableSearch={false}
        enableColumnVisibility
        enableExport
        exportFileName={`student-${studentIdParam}-${categoryName}-courses`}
      />
    </div>
  );
};

export default AdminStudentCategoryCourses;
