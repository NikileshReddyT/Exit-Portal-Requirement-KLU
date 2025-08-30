import React, { useEffect, useMemo, useState } from 'react';
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
  const [query, setQuery] = useState('');
  
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
        const base = `${config.backendUrl}/api/v1/admin/data/categories`;
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
        setError('Failed to load categories');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, navigate, programId]);

  const filtered = useMemo(() => {
    if (!query) return rows;
    const q = query.toLowerCase();
    return rows.filter(r => Object.values(r || {}).some(v => String(v ?? '').toLowerCase().includes(q)));
  }, [rows, query]);

  const handleRowClick = (row) => {
    const name = row.categoryName || row.category || row.name;
    if (name) navigate(`/admin/categories/${encodeURIComponent(String(name))}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Categories</h2>
          <p className="text-sm text-gray-600">Browse categories and drill into courses and outcomes</p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories..."
          className="w-full sm:w-72 border rounded px-3 py-2"
        />
      </div>

      <DataTable rows={filtered} onRowClick={handleRowClick} loading={loading} error={error} emptyText={loading ? '' : (error || 'No categories found')} />
    </div>
  );
};

export default AdminCategories;
