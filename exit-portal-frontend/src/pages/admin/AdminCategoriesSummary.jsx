import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import DataTable from '../../components/admin/DataTable';

const AdminCategoriesSummary = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
        let apiUrl = `${config.backendUrl}/api/v1/admin/dashboard`;
        let effectiveProgramId = null;
        if (user?.userType === 'SUPER_ADMIN' && programId) {
          effectiveProgramId = programId;
        } else if (user?.userType === 'ADMIN' && user?.programId) {
          effectiveProgramId = user.programId;
        }
        if (effectiveProgramId) apiUrl += `?programId=${effectiveProgramId}`;

        const res = await axios.get(apiUrl, { withCredentials: true });
        if (cancelled) return;
        const list = Array.isArray(res.data?.categorySummaries) ? res.data.categorySummaries : [];
        // Reverse order as requested (dashboard sorts by metRate ascending)
        setRows(list.slice().reverse());
      } catch (e) {
        console.error(e);
        if (!cancelled) setError('Failed to load categories summary');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user, navigate, programId]);

  const columns = useMemo(() => ([
    { key: 'category', header: 'Category' },
    { key: 'met', header: 'Met' },
    { key: 'total', header: 'Total' },
    { key: 'metRate', header: 'Met Rate' },
    { key: 'avgCreditCompletion', header: 'Avg Credit Completion' },
  ]), []);

  const basePath = location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Categories Summary</h2>
          <p className="text-sm text-gray-600">Full categories summary from dashboard (reversed order)</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          emptyText={loading ? '' : (error || 'No categories found')}
          onRowClick={(row) => {
            const name = row.category;
            if (name) navigate(`${basePath}/categories-summary/${encodeURIComponent(String(name))}${programId ? `?programId=${programId}` : ''}`);
          }}
          cardTitleKey="category"
        />
      </div>
    </div>
  );
};

export default AdminCategoriesSummary;
