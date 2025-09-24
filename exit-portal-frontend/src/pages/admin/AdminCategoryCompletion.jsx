import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';

const AdminCategoryCompletion = () => {
  const { categoryName } = useParams();
  const { user } = useAuth();
  const { selectedProgramId } = useProgramContext();
  const location = useLocation();
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(location.search);
  const urlProgramId = urlParams.get('programId');
  const programId = selectedProgramId || urlProgramId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState([]);
  const [incomplete, setIncomplete] = useState([]);
  const [incompleteDetailsById, setIncompleteDetailsById] = useState({});
  const [completedDetailsById, setCompletedDetailsById] = useState({});
  const [projectedById, setProjectedById] = useState({});
  const [categoryMinCourses, setCategoryMinCourses] = useState(0);
  const [categoryMinCredits, setCategoryMinCredits] = useState(0);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('id'); // 'id' | 'name'
  const initialProjection = (() => {
    const p = urlParams.get('project');
    return p === 'true' || p === '1';
  })();
  const [projection, setProjection] = useState(initialProjection);

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) {
      navigate('/login');
      return;
    }
  }, [user, navigate]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        let url = `${config.backendUrl}/api/progress/category/completion?categoryName=${encodeURIComponent(categoryName)}&details=true`;
        const effectiveProgramId = (user?.userType === 'SUPER_ADMIN' ? programId : user?.programId) || null;
        if (effectiveProgramId) url += `&programId=${encodeURIComponent(String(effectiveProgramId))}`;
        if (projection) url += `&project=true`;
        const res = await axios.get(url, { withCredentials: true });
        if (cancelled) return;
        const payload = res.data || {};
        setCompleted(Array.isArray(payload.completed) ? payload.completed : []);
        setIncomplete(Array.isArray(payload.incomplete) ? payload.incomplete : []);
        setIncompleteDetailsById(payload.incompleteDetailsById || {});
        setCompletedDetailsById(payload.completedDetailsById || {});
        setProjectedById(payload.projectedById || {});
        setCategoryMinCourses(Number(payload.categoryMinRequiredCourses || 0));
        setCategoryMinCredits(Number(payload.categoryMinRequiredCredits || 0));
      } catch (e) {
        if (!cancelled) setError('Failed to load category completion');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [categoryName, programId, user, projection]);

  const filterSort = (arr) => {
    const q = (query || '').toLowerCase();
    const filtered = (Array.isArray(arr) ? arr : []).filter((s) => {
      const id = String(s.universityId || '').toLowerCase();
      const name = String(s.studentName || '').toLowerCase();
      return !q || id.includes(q) || name.includes(q);
    });
    return filtered.sort((a, b) => {
      if (sort === 'name') return String(a.studentName || '').localeCompare(String(b.studentName || ''));
      return String(a.universityId || '').localeCompare(String(b.universityId || ''));
    });
  };

  const completedView = useMemo(() => filterSort(completed), [completed, query, sort]);
  const incompleteView = useMemo(() => filterSort(incomplete), [incomplete, query, sort]);

  const basePath = location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';
  const goToStudent = (studentId) => {
    const qp = new URLSearchParams();
    qp.set('studentId', String(studentId));
    const effectiveProgramId = (user?.userType === 'SUPER_ADMIN' ? programId : user?.programId) || null;
    if (effectiveProgramId) qp.set('programId', String(effectiveProgramId));
    navigate(`${basePath}/students?${qp.toString()}`);
  };

  // Modal removed; inline metrics shown directly in the list

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase text-gray-500">Category</div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{categoryName}</h2>
            <div className="mt-1 text-xs sm:text-sm text-gray-700">Min Required: <span className="font-semibold">{categoryMinCourses}</span> courses / <span className="font-semibold">{categoryMinCredits.toFixed(1)}</span> credits</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search student id or name..."
              className="w-56 sm:w-72 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-900"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="border rounded-lg px-2 py-2 text-sm text-gray-700"
            >
              <option value="id">Sort by ID</option>
              <option value="name">Sort by Name</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm px-2 py-2 border rounded-lg bg-white">
              <input type="checkbox" checked={projection} onChange={(e) => setProjection(e.target.checked)} />
              <span className="text-gray-700">Projection Mode</span>
            </label>
            <button className="btn px-3 py-2 bg-white border rounded-lg hover:bg-gray-50" onClick={() => navigate(-1)}>Back</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center">
            <div className="flex items-center gap-3 p-4 bg-gray-50 border rounded">
              <div className="h-5 w-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-gray-800 text-sm">Loading…</div>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 sm:p-6">
            <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 text-sm">{error}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Completed */}
            <div className="border-r border-gray-200">
              <div className="p-4 sm:p-5 bg-green-50 border-b">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-green-900 flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-600"></span>
                    Completed{projection && <span className="ml-2 text-xs text-blue-800 bg-blue-100 border border-blue-200 rounded px-2 py-0.5">Projection ON</span>}
                  </div>
                  <div className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 border border-green-200">{completedView.length} students</div>
                </div>
              </div>
              <div className="max-h-[70vh] overflow-auto">
                <div className="divide-y divide-gray-200">
                  {completedView.map((s, i) => {
                    const d = completedDetailsById[s.universityId] || {};
                    const cCourses = d.completedCourses ?? null;
                    const cCredits = d.completedCredits ?? null;
                    const isProjected = Boolean(projectedById && projectedById[s.universityId]);
                    return (
                      <button
                        key={`c-${i}`}
                        className={`btn w-full text-left text-sm leading-tight px-4 py-3 flex items-center justify-between gap-3 focus-visible:outline-none odd:bg-white even:bg-green-50/30 ${isProjected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-green-50'}`}
                        onClick={() => goToStudent(s.universityId)}
                      >
                        <div className="min-w-0">
                          <div className="font-mono tabular-nums font-semibold text-gray-900" title={s.universityId}>{s.universityId}</div>
                          <div className="text-gray-700 text-xs sm:text-sm truncate" title={s.studentName}>{s.studentName}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(cCourses !== null || cCredits !== null) && (
                            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${isProjected ? 'bg-blue-100 text-blue-900 border-blue-200' : 'bg-green-100 text-green-800 border-green-200'}`}>
                              {cCourses !== null ? `C: ${cCourses}` : ''}
                              {(cCourses !== null && cCredits !== null) ? ' | ' : ''}
                              {cCredits !== null ? `Cr: ${Number(cCredits).toFixed(1)}` : ''}
                            </span>
                          )}
                          {isProjected && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">Projected</span>
                          )}
                          <FiChevronRight className="text-green-700 flex-shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                  {completedView.length === 0 && (
                    <div className="px-4 py-8 text-xs text-gray-500">No students</div>
                  )}
                </div>
              </div>
            </div>

            {/* Incomplete */}
            <div>
              <div className="p-4 sm:p-5 bg-red-50 border-b">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-red-900 flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600"></span>
                    Incomplete
                  </div>
                  <div className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">{incompleteView.length} students</div>
                </div>
              </div>
              <div className="max-h-[70vh] overflow-auto">
                <div className="divide-y divide-gray-200">
                  {incompleteView.map((s, i) => {
                    const d = incompleteDetailsById[s.universityId] || {};
                    const cCourses = d.completedCourses ?? null;
                    const cCredits = d.completedCredits ?? null;
                    const rCourses = d.registeredCourses ?? null;
                    const rCredits = d.registeredCredits ?? null;
                    const showReg = (rCourses ?? 0) > 0 || (rCredits ?? 0) > 0;
                    return (
                      <button
                        key={`i-${i}`}
                        className="btn w-full text-left text-sm leading-tight px-4 py-3 flex items-center justify-between gap-3 hover:bg-red-50 focus-visible:outline-none odd:bg-white even:bg-red-50/30"
                        onClick={() => goToStudent(s.universityId)}
                      >
                        <div className="min-w-0">
                          <div className="font-mono tabular-nums font-semibold text-gray-900" title={s.universityId}>{s.universityId}</div>
                          <div className="text-gray-700 text-xs sm:text-sm truncate" title={s.studentName}>{s.studentName}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(cCourses !== null || cCredits !== null) && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 border border-gray-200" title="Completed">
                              C: {cCourses !== null ? cCourses : '-'}{(cCourses !== null && cCredits !== null) ? ' | ' : ' '}
                              {cCredits !== null ? `Cr: ${Number(cCredits).toFixed(1)}` : ''}
                            </span>
                          )}
                          {showReg && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200" title="Registered">
                              reg({rCourses ?? 0}c/{(rCredits ?? 0).toFixed ? (Number(rCredits).toFixed(1)) : Number(rCredits || 0).toFixed(1)}cr)
                            </span>
                          )}
                          <FiChevronRight className="text-red-700 flex-shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                  {incompleteView.length === 0 && (
                    <div className="px-4 py-8 text-xs text-gray-500">No students</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Modal removed */}
    </div>
  );
};

export default AdminCategoryCompletion;
