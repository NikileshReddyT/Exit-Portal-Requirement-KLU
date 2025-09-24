import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
// import DataTable from '../../components/admin/DataTable';

const AdminStudents = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedProgramId } = useProgramContext();
  const [error, setError] = useState('');

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Close suggestions on outside click
  const searchBoxRef = useRef(null);
  
  // Get programId from URL params or context
  const urlParams = new URLSearchParams(location.search);
  const urlProgramId = urlParams.get('programId');
  const programId = selectedProgramId || urlProgramId;

  // Resolve base path for admin vs superadmin
  const basePath = location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) {
      navigate('/login');
      return;
    }
  }, [user, navigate]);

  useEffect(() => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (query) p.set('q', query); else p.delete('q');
      return p;
    }, { replace: true });
  }, [query, setSearchParams]);

  // If page opened with ?studentId=..., preselect that student (and optionally hydrate name via search API)
  useEffect(() => {
    const paramStudentId = searchParams.get('studentId');
    if (!paramStudentId) return;
    // If already selected same student, skip
    if (selected && String(selected.id) === String(paramStudentId)) return;
    let cancelled = false;
    const run = async () => {
      try {
        // Try to find the exact student via search endpoint
        const base = `${config.backendUrl}/api/v1/admin/data/students/search`;
        const params = new URLSearchParams();
        params.append('q', String(paramStudentId));
        params.append('limit', '5');
        if (user?.userType === 'SUPER_ADMIN' && programId) {
          params.append('programId', String(programId));
        } else if (user?.userType === 'ADMIN' && user?.programId) {
          params.append('programId', String(user.programId));
        }
        const url = `${base}?${params.toString()}`;
        const res = await axios.get(url, { withCredentials: true });
        const list = Array.isArray(res.data) ? res.data : [];
        const exact = list.find(s => String(s.studentId) === String(paramStudentId)) || list[0];
        if (!cancelled) {
          if (exact) {
            setSelected({ id: String(exact.studentId), name: exact.studentName || '' });
          } else {
            // Fallback to ID only
            setSelected({ id: String(paramStudentId), name: '' });
          }
          // Prefill search box with the studentId for context
          setQuery(String(paramStudentId));
          setShowSuggestions(false);
        }
      } catch (e) {
        if (!cancelled) {
          setSelected({ id: String(paramStudentId), name: '' });
          setQuery(String(paramStudentId));
          setShowSuggestions(false);
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [searchParams, user, programId, selected]);

  // Debounced search for suggestions
  useEffect(() => {
    let cancelled = false;
    const handler = setTimeout(async () => {
      const q = (query || '').trim();
      if (!q || q.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        setSearching(true);
        setError('');
        const base = `${config.backendUrl}/api/v1/admin/data/students/search`;
        const params = new URLSearchParams();
        params.append('q', q);
        params.append('limit', '10');
        if (user?.userType === 'SUPER_ADMIN' && programId) {
          params.append('programId', String(programId));
        } else if (user?.userType === 'ADMIN' && user?.programId) {
          params.append('programId', String(user.programId));
        }
        const url = `${base}?${params.toString()}`;
        const res = await axios.get(url, { withCredentials: true });
        if (!cancelled) setSuggestions(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError('Search failed');
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handler);
    };
  }, [query, user, programId]);

  // Reset activeIndex when suggestions update
  useEffect(() => {
    setActiveIndex(suggestions.length ? 0 : -1);
  }, [suggestions]);

  // Outside click to close suggestions
  useEffect(() => {
    const onClick = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleKeyDown = (e) => {
    if (!showSuggestions || !suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        handleRowClick(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleRowClick = (row) => {
    const id = row.universityId || row.studentId || row.id || row.UniversityId || row.StudentId;
    if (id) {
      setSelected({ id: String(id), name: row.studentName || row.name || '' });
      // collapse suggestions
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">Students</h2>
        <p className="text-sm text-gray-600">Search and open a student's details</p>
        <div className="w-full flex justify-center">
          <div ref={searchBoxRef} className="relative w-full max-w-2xl">
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
              onKeyDown={handleKeyDown}
              placeholder="Search by ID or name..."
              className="w-full border rounded-full px-5 py-4 text-lg shadow focus:outline-none focus:ring-2 focus:ring-red-900"
            />
            {showSuggestions && query.trim().length >= 2 && (
              <div
                className="absolute z-10 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-auto text-left"
                role="listbox"
                aria-label="Student suggestions"
              >
                {searching ? (
                  <div className="p-3 text-sm text-gray-500">Searching...</div>
                ) : (suggestions.length > 0 ? (
                  suggestions.map((s, idx) => (
                    <button
                      key={s.studentId}
                      onClick={() => handleRowClick(s)}
                      role="option"
                      aria-selected={activeIndex === idx}
                      className={`btn w-full text-left bg-white px-4 py-3 transition border-b border-gray-100 last:border-0 flex flex-row justify-between items-center ${activeIndex === idx ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-start w-full gap-3">
                        <span className="font-semibold text-gray-900 tabular-nums shrink-0">{s.studentId}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-gray-800 leading-snug break-words" title={s.studentName}>{s.studentName}</div>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-sm text-gray-500">No matches</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow p-6 border border-red-900/20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-gray-500">Selected Student</div>
              <div className="text-lg font-semibold text-gray-900 break-words">{selected.id}{selected.name ? ` · ${selected.name}` : ''}</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                className="px-4 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-900 shadow-sm"
                onClick={() => navigate(`${basePath}/students/${encodeURIComponent(selected.id)}`)}
              >
                By Courses
              </button>
              <button
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
                onClick={() => {
                  const qp = programId
                    ? `?studentId=${encodeURIComponent(selected.id)}&programId=${encodeURIComponent(String(programId))}`
                    : `?studentId=${encodeURIComponent(selected.id)}`;
                  navigate(`${basePath}/progress${qp}`);
                }}
              >
                By Category
              </button>
              <button
                className="px-4 py-2 rounded-lg border border-red-900 text-red-900 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-900/30"
                onClick={() => {
                  const qp = `?studentId=${encodeURIComponent(selected.id)}`;
                  navigate(`${basePath}/report${qp}`);
                }}
              >
                Report
              </button>
            </div>
          </div>

        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3">{error}</div>
      )}
    </div>
  );
};

export default AdminStudents;

