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
  const [studentId, setStudentId] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const base = `${config.backendUrl}/api/v1/admin/data/progress`;
      const params = new URLSearchParams();
      // For SUPER_ADMIN, use programId from context/URL if available
      // For ADMIN, always use their assigned program
      if (user?.userType === 'SUPER_ADMIN' && programId) {
        params.append('programId', String(programId));
      } else if (user?.userType === 'ADMIN' && user?.programId) {
        params.append('programId', String(user.programId));
      }
      if (studentId.trim()) params.append('studentId', studentId.trim());
      const url = params.toString() ? `${base}?${params}` : base;
      const res = await axios.get(url, { withCredentials: true });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      setError('Failed to load progress');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, programId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Progress</h2>
          <p className="text-sm text-gray-600">Track category/course completion across students</p>
        </div>
        <div className="w-full sm:w-auto flex items-center gap-2">
          <input
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="Filter by student ID"
            className="w-full sm:w-72 border rounded px-3 py-2"
          />
          <button onClick={() => load()} className="px-3 py-2 border rounded bg-white hover:bg-gray-50">Apply</button>
        </div>
      </div>

      <DataTable rows={rows} loading={loading} error={error} emptyText={loading ? '' : (error || 'No progress data found')} />
    </div>
  );
};

export default AdminProgress;
