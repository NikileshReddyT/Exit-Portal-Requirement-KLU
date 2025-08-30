import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import DataTable from '../../components/admin/DataTable';

const AdminStudents = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedProgramId } = useProgramContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState(searchParams.get('q') || '');
  
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
        const base = `${config.backendUrl}/api/v1/admin/data/students`;
        const params = new URLSearchParams();
        
        // For SUPER_ADMIN, use programId from context/URL if available
        // For ADMIN, always use their assigned program
        if (user?.userType === 'SUPER_ADMIN' && programId) {
          params.append('programId', String(programId));
        } else if (user?.userType === 'ADMIN' && user?.programId) {
          params.append('programId', String(user.programId));
        }
        
        const url = params.toString() ? `${base}?${params}` : base;
        const res = await axios.get(url, { withCredentials: true });
        setRows(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error(e);
        setError('Failed to load students');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, navigate, programId]);

  useEffect(() => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (query) p.set('q', query); else p.delete('q');
      return p;
    });
  }, [query, setSearchParams]);

  const filtered = useMemo(() => {
    if (!query) return rows;
    const q = query.toLowerCase();
    return rows.filter(r => Object.values(r || {}).some(v => String(v ?? '').toLowerCase().includes(q)));
  }, [rows, query]);

  const handleRowClick = (row) => {
    const id = row.universityId || row.studentId || row.id || row.UniversityId || row.StudentId;
    if (id) {
      navigate(`/admin/students/${encodeURIComponent(String(id))}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Students</h2>
          <p className="text-sm text-gray-600">Browse and drill into individual student insights</p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search students..."
          className="w-full sm:w-72 border rounded px-3 py-2"
        />
      </div>

      <DataTable
        rows={filtered}
        onRowClick={handleRowClick}
        emptyText={loading ? '' : (error || 'No students found')}
        loading={loading}
        error={error}
        cardTitleKey={Object.keys(filtered?.[0] || rows?.[0] || { name: 'name' })[0]}
      />
    </div>
  );
};

export default AdminStudents;
