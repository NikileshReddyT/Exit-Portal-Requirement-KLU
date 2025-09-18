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
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailStudent, setDetailStudent] = useState(null); // { id, name, metrics }
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('id'); // 'id' | 'name'

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
        const res = await axios.get(url, { withCredentials: true });
        if (cancelled) return;
        const payload = res.data || {};
        setCompleted(Array.isArray(payload.completed) ? payload.completed : []);
        setIncomplete(Array.isArray(payload.incomplete) ? payload.incomplete : []);
        setIncompleteDetailsById(payload.incompleteDetailsById || {});
      } catch (e) {
        if (!cancelled) setError('Failed to load category completion');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [categoryName, programId, user]);

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

  const openDetails = (student) => {
    const d = incompleteDetailsById[student.universityId] || {};
    setDetailStudent({
      id: student.universityId,
      name: student.studentName,
      metrics: {
        minRequiredCourses: d.minRequiredCourses ?? 0,
        minRequiredCredits: d.minRequiredCredits ?? 0,
        completedCourses: d.completedCourses ?? 0,
        completedCredits: d.completedCredits ?? 0,
        missingCourses: d.missingCourses ?? 0,
        missingCredits: d.missingCredits ?? 0,
        registeredCourses: d.registeredCourses ?? 0,
        registeredCredits: d.registeredCredits ?? 0,
      }
    });
    setDetailOpen(true);
  };

  const closeDetails = () => {
    setDetailOpen(false);
    setDetailStudent(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase text-gray-500">Category</div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{categoryName}</h2>
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
                    Completed
                  </div>
                  <div className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 border border-green-200">{completedView.length} students</div>
                </div>
              </div>
              <div className="max-h-[70vh] overflow-auto">
                <div className="divide-y divide-gray-200">
                  {completedView.map((s, i) => (
                    <button
                      key={`c-${i}`}
                      className="btn w-full text-left text-sm leading-tight px-4 py-3 flex items-center justify-between gap-3 hover:bg-green-50 focus-visible:outline-none odd:bg-white even:bg-green-50/30"
                      onClick={() => goToStudent(s.universityId)}
                    >
                      <div className="min-w-0">
                        <div className="font-mono tabular-nums font-semibold text-gray-900" title={s.universityId}>{s.universityId}</div>
                        <div className="text-gray-700 text-xs sm:text-sm truncate" title={s.studentName}>{s.studentName}</div>
                      </div>
                      <FiChevronRight className="text-green-700 flex-shrink-0" />
                    </button>
                  ))}
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
                        <button
                          className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
                          onClick={(e) => { e.stopPropagation(); openDetails(s); }}
                        >Details</button>
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
      {detailOpen && detailStudent && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={closeDetails} />
          {/* Modal */}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-xl border">
              <div className="p-4 sm:p-5 border-b flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-gray-500">Student</div>
                  <div className="font-semibold text-gray-900">
                    <span className="font-mono mr-2">{detailStudent.id}</span>
                    <span className="text-gray-700">{detailStudent.name}</span>
                  </div>
                </div>
                <button onClick={closeDetails} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Close</button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="text-xs uppercase text-gray-500 mb-1">Required</div>
                    <div className="text-sm text-gray-800">
                      Courses: <span className="font-semibold">{detailStudent.metrics.minRequiredCourses}</span>
                    </div>
                    <div className="text-sm text-gray-800">
                      Credits: <span className="font-semibold">{Number(detailStudent.metrics.minRequiredCredits).toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                    <div className="text-xs uppercase text-green-700 mb-1">Completed</div>
                    <div className="text-sm text-green-900">
                      Courses: <span className="font-semibold">{detailStudent.metrics.completedCourses}</span>
                    </div>
                    <div className="text-sm text-green-900">
                      Credits: <span className="font-semibold">{Number(detailStudent.metrics.completedCredits).toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="border rounded-lg p-4 bg-amber-50 border-amber-200">
                    <div className="text-xs uppercase text-amber-700 mb-1">Missing</div>
                    <div className="text-sm text-amber-900">
                      Courses: <span className="font-semibold">{detailStudent.metrics.missingCourses}</span>
                    </div>
                    <div className="text-sm text-amber-900">
                      Credits: <span className="font-semibold">{Number(detailStudent.metrics.missingCredits).toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                    <div className="text-xs uppercase text-blue-700 mb-1">Registered</div>
                    <div className="text-sm text-blue-900">
                      Courses: <span className="font-semibold">{detailStudent.metrics.registeredCourses}</span>
                    </div>
                    <div className="text-sm text-blue-900">
                      Credits: <span className="font-semibold">{Number(detailStudent.metrics.registeredCredits).toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-5 border-t flex items-center justify-end gap-2">
                <button onClick={closeDetails} className="px-4 py-2 border rounded hover:bg-gray-50">Close</button>
                <button
                  onClick={() => { const id = detailStudent.id; closeDetails(); goToStudent(id); }}
                  className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800"
                >View Student</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCategoryCompletion;
