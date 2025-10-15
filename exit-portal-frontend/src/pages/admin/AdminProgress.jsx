import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import DataTable from '../../components/admin/DataTable';

const AdminProgress = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { selectedProgramId } = useProgramContext();
  
  // Get programId from URL params or context
  const urlParams = new URLSearchParams(location.search);
  const urlProgramId = urlParams.get('programId');
  const programId = selectedProgramId || urlProgramId;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Pagination
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  // Search: input vs debounced value for server fetch
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const load = async (opts = {}) => {
    try {
      setLoading(true);
      setError('');
      const base = `${config.backendUrl}/api/v1/admin/data/progress/paged`;
      const params = new URLSearchParams();
      const p = Number.isFinite(opts.page) ? opts.page : page;
      const sz = Number.isFinite(opts.size) ? opts.size : size;
      // For SUPER_ADMIN, use programId from context/URL if available
      // For ADMIN, always use their assigned program
      if (user?.userType === 'SUPER_ADMIN' && programId) {
        params.append('programId', String(programId));
      } else if (user?.userType === 'ADMIN' && user?.programId) {
        params.append('programId', String(user.programId));
      }
      const idToUse = typeof opts.overrideStudentId === 'string' ? opts.overrideStudentId : studentId;
      if (idToUse && idToUse.trim()) params.append('studentId', idToUse.trim());
      if (debouncedSearch && debouncedSearch.trim()) params.append('q', debouncedSearch.trim());
      params.append('page', String(p));
      params.append('size', String(sz));
      const url = params.toString() ? `${base}?${params}` : base;
      const res = await axios.get(url, { withCredentials: true });
      const data = res.data || {};
      const list = Array.isArray(data.content) ? data.content : [];
      setRows(list);
      setTotalPages(Number.isFinite(data.totalPages) ? data.totalPages : 0);
      setTotalElements(typeof data.totalElements === 'number' ? data.totalElements : 0);
      // Try to capture student's name from payload if present
      const first = list && list.length ? list[0] : null;
      const resolvedName = first?.studentName || first?.name || '';
      if (resolvedName) setStudentName(String(resolvedName));
    } catch (e) {
      console.error(e);
      setError('Failed to load progress');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) return;
    const params = new URLSearchParams(location.search);
    const sid = params.get('studentId') || '';
    setStudentId(sid);
    // reset to first page on initial load
    setPage(0);
    load({ overrideStudentId: sid, page: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, programId, location.search]);

  // Debounce search input to avoid refetching on every keypress
  useEffect(() => {
    const h = setTimeout(() => {
      setPage(0);
      setDebouncedSearch((searchInput || '').trim());
    }, 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Refetch when debounced search changes
  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) return;
    load({ page: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Progress</h2>
          <p className="text-sm text-gray-600">
            {studentId?.trim() ? (
              <>Category progress for student <span className="font-semibold">{studentId.trim()}</span></>
            ) : (
              <>Track category/course completion across students</>
            )}
          </p>
        </div>
      </div>

      {/* Selected student details */}
      {studentId?.trim() && (
        <div className="bg-white rounded-lg shadow p-4 border border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="text-sm">
              <div className="text-gray-500">Student ID</div>
              <div className="font-medium text-gray-900 break-words">{studentId.trim()}</div>
            </div>
            <div className="text-sm">
              <div className="text-gray-500">Student Name</div>
              <div className="font-medium text-gray-900 break-words">{studentName || '—'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Explicit columns and labels per requirement */}
      <DataTable
        columns={useMemo(() => (
          [
            { key: 'universityId', header: 'Student ID' },
            { key: 'categoryName', header: 'Category' },
            { key: 'minRequiredCourses', header: 'Required Courses', className: 'text-center' },
            { key: 'completedCourses', header: 'Completed Courses', className: 'text-center' },
            { key: 'minRequiredCredits', header: 'Required Credits', className: 'text-center' },
            { key: 'completedCredits', header: 'Completed Credits', className: 'text-center' },
          ]
        ), [])}
        rows={rows}
        loading={loading}
        error={error}
        emptyText={loading ? '' : (error || 'No progress data found')}
        serverSide
        page={page}
        size={size}
        totalPages={totalPages}
        totalElements={totalElements}
        onPageChange={(p) => { setPage(p); load({ page: p }); }}
        onSizeChange={(val) => { setSize(val); setPage(0); load({ size: val, page: 0 }); }}
        // Search wired like AdminStudents/AdminMatrix
        defaultSearch={searchInput}
        onSearchChange={(val) => { setSearchInput(val); }}
        // Export all pages, server-side fetch
        enableExport
        exportFileName={studentId?.trim() ? `progress_${studentId.trim()}` : 'progress'}
        exportAllFetcher={async () => {
          const all = [];
          const exportSize = 1000;
          let pageIdx = 0;
          while (true) {
            const params = new URLSearchParams();
            if (user?.userType === 'SUPER_ADMIN' && programId) {
              params.append('programId', String(programId));
            } else if (user?.userType === 'ADMIN' && user?.programId) {
              params.append('programId', String(user.programId));
            }
            if (studentId && studentId.trim()) params.append('studentId', studentId.trim());
            if (debouncedSearch && debouncedSearch.trim()) params.append('q', debouncedSearch.trim());
            params.append('page', String(pageIdx));
            params.append('size', String(exportSize));
            const url = `${config.backendUrl}/api/v1/admin/data/progress/paged?${params.toString()}`;
            const res = await axios.get(url, { withCredentials: true });
            const data = res.data || {};
            const content = Array.isArray(data.content) ? data.content : [];
            all.push(...content);
            const tp = Number.isFinite(data.totalPages) ? data.totalPages : 0;
            pageIdx += 1;
            if (pageIdx >= tp || !content.length) break;
          }
          return all;
        }}
        enableColumnFilters={false}
      />
    </div>
  );
};

export default AdminProgress;
