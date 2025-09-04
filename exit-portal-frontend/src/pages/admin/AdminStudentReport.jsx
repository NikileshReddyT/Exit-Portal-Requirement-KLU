import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLoader, FiAlertTriangle, FiChevronDown, FiRefreshCw } from 'react-icons/fi';
import PdfDownloadButton from '../../components/ui/PdfDownloadButton';

const AdminStudentReport = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { selectedProgramId } = useProgramContext();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const studentId = params.get('studentId') || '';
  const urlProgramId = params.get('programId');
  const effectiveProgramId = selectedProgramId || urlProgramId || user?.programId || null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);

  // Simple client-side cache to avoid refetch on hot-reload/design tweaks
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  const cacheKey = studentId ? `report:${studentId}` : null;

  const categoriesByName = useMemo(() => {
    const map = new Map();
    (data?.categories || []).forEach(c => map.set(c.categoryName, c));
    return map;
  }, [data]);

  // Helpers from PdfDownloadButton - exact same normalization
  const normalizeYear = (y) => String(y ?? '').replace(/\s+/g, '').replace(/[–—]/g, '-').replace(/-+/g, '-');
  const normalizeSem = (s) => {
    const up = String(s ?? '').toUpperCase();
    if (up.includes('ODD')) return 'ODD';
    if (up.includes('EVEN')) return 'EVEN';
    if (up.includes('SUMMER')) return 'SUMMER';
    return up;
  };
  const filterYearNorm = normalizeYear(data?.filterYear ?? data?.year ?? '');
  const filterSemNorm = normalizeSem(data?.filterSemester ?? data?.semester ?? '');

  // Registered detection - exact same as PdfDownloadButton
  const isRegistered = (c) => {
    const grade = (c.grade ?? '').toString().trim();
    const promo = (c.promotion ?? '').toString().toUpperCase();
    return grade === '' || promo === 'R';
  };

  useEffect(() => {
    let cancelled = false;
    const load = async (force = false) => {
      if (!studentId) return;
      setLoading(true);
      setError('');
      try {
        // Try session cache (to mitigate full-page refresh network calls during HMR)
        if (!force && cacheKey) {
          const raw = sessionStorage.getItem(cacheKey);
          if (raw) {
            try {
              const cached = JSON.parse(raw);
              if (cached && cached.timestamp && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
                if (!cancelled) {
                  setData(cached.payload);
                  setLoading(false);
                  return; // skip network
                }
              }
            } catch { /* ignore */ }
          }
        }
        const { data } = await axios.post(
          `${config.backendUrl}/api/v1/frontend/generatereport`,
          { universityId: studentId }
        );
        if (cancelled) return;
        const shaped = { ...data };
        // Reverse arrays to match PdfDownloadButton
        if (Array.isArray(shaped.categoryProgress)) shaped.categoryProgress = [...shaped.categoryProgress].reverse();
        if (Array.isArray(shaped.categories)) shaped.categories = [...shaped.categories].reverse();
        setData(shaped);
        // Save to cache
        if (cacheKey) {
          try { sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), payload: shaped })); } catch {}
        }
      } catch (e) {
        if (cancelled) return;
        console.error('Failed to load report:', e);
        setError('Failed to load report');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [studentId, cacheKey, CACHE_TTL_MS]);

  const handleRefresh = () => {
    if (!studentId) return;
    if (cacheKey) sessionStorage.removeItem(cacheKey);
    setLoading(true);
    setError('');
    (async () => {
      try {
        const { data } = await axios.post(
          `${config.backendUrl}/api/v1/frontend/generatereport`,
          { universityId: studentId }
        );
        const shaped = { ...data };
        if (Array.isArray(shaped.categoryProgress)) shaped.categoryProgress = [...shaped.categoryProgress].reverse();
        if (Array.isArray(shaped.categories)) shaped.categories = [...shaped.categories].reverse();
        setData(shaped);
        if (cacheKey) {
          try { sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), payload: shaped })); } catch {}
        }
      } catch (e) {
        console.error(e);
        setError('Failed to load report');
      } finally {
        setLoading(false);
      }
    })();
  };

  // Exact totals calculation from PdfDownloadButton
  const totals = useMemo(() => {
    const categories = data?.categories || [];
    const totalCompletedCourses = categories.reduce((sum, c) => sum + (c.completedCourses || 0), 0);
    const totalCompletedCredits = categories.reduce((sum, c) => sum + (c.completedCredits || 0), 0);
    const totalReqCourses = categories.reduce((sum, c) => sum + (c.minRequiredCourses || 0), 0);
    const totalReqCredits = categories.reduce((sum, c) => sum + (c.minRequiredCredits || 0), 0);
    const pctCredits = totalReqCredits > 0 ? (totalCompletedCredits / totalReqCredits) * 100 : 100;
    return { totalCompletedCourses, totalCompletedCredits, totalReqCourses, totalReqCredits, pctCredits };
  }, [data]);

  const guard = !user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Student Report</h2>
          <p className="text-sm text-gray-600">
            {studentId ? (
              <>Detailed report for student <span className="font-semibold">{studentId}</span></>
            ) : (
              <>Select a student from the Students page to view their report</>
            )}
          </p>
          {effectiveProgramId && (
            <p className="text-xs text-gray-500 mt-1">Program: {String(effectiveProgramId)}</p>
          )}
        </div>
        {studentId && (
          <motion.div className="flex items-center gap-3" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            <div
              onClick={handleRefresh}
              className="flex items-center gap-2 text-gray-600 hover:bg-gray-50 cursor-pointer text-sm  px-4 py-2 rounded-lg border border-gray-200"
            >
              <FiRefreshCw className={loading ? 'animate-spin' : ''} size={14} />
              Refresh
            </div>
            <PdfDownloadButton studentId={studentId} wrapperClassName="flex items-center" />
          </motion.div>
        )}
      </div>

      {guard && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 flex items-center gap-2">
          <FiAlertTriangle className="shrink-0" />
          <span>Access restricted. Admins only.</span>
        </div>
      )}

      {!studentId && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-gray-600">No student selected.</div>
      )}

      {studentId && (
        <AnimatePresence>
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-gray-600"
            >
              <FiLoader className="animate-spin" /> Loading report...
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3"
            >
              {error}
            </motion.div>
          ) : data ? (
            <motion.div key="content" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Student Info */}
              <motion.div className="bg-white rounded-xl shadow p-5 border border-gray-100" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500">Student ID</div>
                    <div className="font-semibold text-gray-900 break-words">{data.studentId || studentId}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500">Student Name</div>
                    <div className="font-semibold text-gray-900 break-words">{data.studentName || '—'}</div>
                  </div>
                </div>
              </motion.div>

              {/* Totals with progress */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <motion.div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm" whileHover={{ y: -2 }}>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Completed Courses</div>
                  <div className="mt-1 text-2xl font-bold text-red-900">
                    {totals.totalCompletedCourses}
                    <span className="text-sm font-normal text-gray-500 ml-1">/ {totals.totalReqCourses}</span>
                  </div>
                </motion.div>
                <motion.div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm" whileHover={{ y: -2 }}>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Completed Credits</div>
                  <div className="mt-1 text-2xl font-bold text-red-900">
                    {totals.totalCompletedCredits}
                    <span className="text-sm font-normal text-gray-500 ml-1">/ {totals.totalReqCredits}</span>
                  </div>
                </motion.div>
                <motion.div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm" whileHover={{ y: -2 }}>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Progress (Credits)</div>
                  <div className="mt-1 text-2xl font-bold text-red-900">{Math.round(totals.pctCredits)}%</div>
                </motion.div>
              </div>

              {/* Category Progress Summary with hover tooltip and expandable details */}
              <div className="bg-white rounded-xl shadow p-5 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Category Progress</h3>
                </div>
                
                {/* Color Legend */}
                <div className="flex items-center gap-4 mb-4 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-600 rounded"></div>
                    <span>Completed</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-amber-400 rounded"></div>
                    <span>Registered</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-gray-200 rounded"></div>
                    <span>Remaining</span>
                  </div>
                </div>
                <div className="space-y-4">
                  {(data.categoryProgress || []).map((cp, idx) => {
                    const reqC = Number(cp.minRequiredCourses) || 0;
                    const regC = Number(cp.registeredCourses) || 0;
                    const doneC = Number(cp.completedCourses) || 0;
                    const reqCr = Number(cp.minRequiredCredits) || 0;
                    const regCr = Number(cp.registeredCredits) || 0;
                    const doneCr = Number(cp.completedCredits) || 0;
                    const pctComplete = reqC > 0 ? (doneC / reqC) * 100 : 100;
                    const pctRegistered = reqC > 0 ? (regC / reqC) * 100 : 0;
                    const cat = categoriesByName.get(cp.categoryName);

                    // Status logic inspired by PdfDownloadButton
                    const requirementMet = (doneC >= reqC) && (doneCr >= reqCr);
                    const remainingCourses = Math.max(0, reqC - doneC);
                    const remainingCredits = Math.max(0, reqCr - doneCr);
                    const virtuallyMetWithRegistered = !requirementMet && (regC >= reqC) && (regCr >= reqCr) && (doneC < reqC) && (doneCr < reqCr);

                    const barBg = 'bg-gray-200';
                    const labelBadge = requirementMet ? 'bg-green-100 text-green-800' : (virtuallyMetWithRegistered ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700');

                    return (
                      <motion.div
                        key={cp.categoryName || idx}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div
                          onClick={() => setExpandedCategory(prev => prev === cp.categoryName ? null : cp.categoryName)}
                          className="w-full text-left cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors"
                        >
                          <div className="flex items-center justify-between w-full gap-4">
                            <div>
                              <div className="text-sm text-gray-500">Category</div>
                              <div className="font-semibold text-gray-900 flex items-center gap-2">
                                {cp.categoryName}
                                <span className={`px-2 py-0.5 rounded-full text-xs ${labelBadge}`}>
                                  {requirementMet
                                    ? 'Met'
                                    : virtuallyMetWithRegistered
                                      ? `${remainingCourses} courses (${remainingCredits} credits) pending`
                                      : 'Pending'}
                                </span>
                              </div>
                            </div>
                            <div className="text-sm text-gray-700 flex items-center gap-1">
                              {doneC} / {reqC} courses
                              <FiChevronDown className={`transition-transform ${expandedCategory === cp.categoryName ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                          <div className="mt-3 group relative">
                            <div className={`w-full h-3 ${barBg} rounded-full overflow-hidden relative`}>
                              {/* Registered segment */}
                              <motion.div
                                className="absolute left-0 top-0 h-3 bg-amber-400/60"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, Math.max(0, pctRegistered))}%` }}
                                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                              />
                              {/* Completed segment overlays registered */}
                              <motion.div
                                className="absolute left-0 top-0 h-3 bg-green-600"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, Math.max(0, pctComplete))}%` }}
                                transition={{ type: 'spring', stiffness: 140, damping: 18 }}
                              />
                            </div>
                            {/* Tooltip (appears on hover of the bar) */}
                            <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full bg-white border border-gray-200 shadow-lg rounded-md px-3 py-2 text-xs text-gray-700 z-10">
                              <div className="font-medium text-gray-900 mb-1">{cp.categoryName}</div>
                              <div>Courses — Req: <span className="font-semibold">{reqC}</span>, Reg: <span className="font-semibold">{regC}</span>, Done: <span className="font-semibold">{doneC}</span></div>
                              <div>Credits — Req: <span className="font-semibold">{reqCr}</span>, Reg: <span className="font-semibold">{regCr}</span>, Done: <span className="font-semibold">{doneCr}</span></div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Category Details (inline) */}
                        <AnimatePresence initial={false}>
                          {expandedCategory === cp.categoryName && cat && (
                            <motion.div
                              key="expanded"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25 }}
                              className="mt-4"
                            >
                              {(() => {
                                // Compute registered and status analogous to PdfDownloadButton
                                const reqCourses = Number(cat.minRequiredCourses) || 0;
                                const reqCredits = Number(cat.minRequiredCredits) || 0;
                                const doneCourses = Number(cat.completedCourses) || 0;
                                const doneCredits = Number(cat.completedCredits) || 0;
                                const requirementMetCat = (doneCourses >= reqCourses) && (doneCredits >= reqCredits);
                                const completed = Array.isArray(cat.courses) ? [...cat.courses] : [];
                                const availableRaw = Array.isArray(cat.incompleteCourses) ? [...cat.incompleteCourses] : [];
                                const isRegistered = (c) => {
                                  const grade = (c.grade ?? '').toString().trim();
                                  const promo = (c.promotion ?? '').toString().toUpperCase();
                                  return grade === '' || promo === 'R';
                                };
                                const registeredList = completed.filter(isRegistered);
                                const registeredCount = registeredList.length;
                                const registeredCredits = registeredList.reduce((s, c) => s + (Number(c.credits) || 0), 0);
                                const remainingCoursesCat = Math.max(0, reqCourses - doneCourses);
                                const remainingCreditsCat = Math.max(0, reqCredits - doneCredits);
                                const virtuallyMetWithRegisteredCat = !requirementMetCat && (registeredCount >= remainingCoursesCat) && (registeredCredits >= remainingCreditsCat);
                                const remainingCoursesExclReg = Math.max(0, remainingCoursesCat - registeredCount);
                                const remainingCreditsExclReg = Math.max(0, remainingCreditsCat - registeredCredits);
                                const showExcluding = registeredCount > 0 || registeredCredits > 0;
                                const coursesRemainingDisplay = showExcluding ? remainingCoursesExclReg : remainingCoursesCat;
                                const creditsRemainingDisplay = showExcluding ? remainingCreditsExclReg : remainingCreditsCat;

                                // Sort tables chronologically (year, sem), then courseCode
                                const normalizeYear = (y) => String(y ?? '').replace(/\s+/g, '').replace(/[–—]/g, '-').replace(/-+/g, '-');
                                const SEM_ORDER = { ODD: 1, EVEN: 2, SUMMER: 3 };
                                const normalizeSem = (s) => {
                                  const up = String(s ?? '').toUpperCase();
                                  if (up.includes('ODD')) return 'ODD';
                                  if (up.includes('EVEN')) return 'EVEN';
                                  if (up.includes('SUMMER')) return 'SUMMER';
                                  return up;
                                };
                                const semKey = s => SEM_ORDER[normalizeSem(s)] ?? 99;
                                const compareYearSem = (a, b) => {
                                  const ya = normalizeYear(a.year);
                                  const yb = normalizeYear(b.year);
                                  if (ya !== yb) return ya.localeCompare(yb);
                                  const sa = semKey(a.semester);
                                  const sb = semKey(b.semester);
                                  if (sa !== sb) return sa - sb;
                                  return (a.courseCode || '').localeCompare(b.courseCode || '');
                                };
                                completed.sort(compareYearSem);
                                const available = availableRaw.sort((a,b) => (a.courseCode||'').localeCompare(b.courseCode||''));

                                return (
                                  <div className="space-y-3">
                                    {/* Enrolled Courses */}
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                      <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                                        📚 Enrolled Courses
                                      </h4>
                                      <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm bg-white rounded border border-blue-200">
                                          <thead className="bg-blue-100">
                                            <tr className="text-left text-blue-800 ">
                                              <th className="py-3 px-4 font-semibold text-center">Code</th>
                                              <th className="py-3 px-4 font-semibold ">Name</th>
                                              <th className="py-3 px-4 font-semibold text-center">Year</th>
                                              <th className="py-3 px-4 font-semibold text-center">Semester</th>
                                              <th className="py-3 px-4 font-semibold text-center">Credits</th>
                                              <th className="py-3 px-4 font-semibold text-center">Grade</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {completed.length > 0 ? completed.map((c, i) => (
                                              <tr key={i} className="border-t border-blue-100 hover:bg-blue-25">
                                                <td className="py-3 px-4 font-mono text-blue-900 text-center">{c.courseCode || '-'}</td>
                                                <td className="py-3 px-4 text-gray-700 ">{c.courseName || '-'}</td>
                                                <td className="py-3 px-4 text-gray-600 text-center">{c.year || '-'}</td>
                                                <td className="py-3 px-4 text-gray-600 text-center">{c.semester || '-'}</td>
                                                <td className="py-3 px-4 text-gray-600 text-center">{c.credits ?? '-'}</td>
                                                <td className="py-3 px-4 text-center">
                                                  {(String(c.promotion || '').toUpperCase() === 'R' || !String(c.grade || '').trim()) ? 
                                                    <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs">Registered</span> : 
                                                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">{c.grade}</span>
                                                  }
                                                </td>
                                              </tr>
                                            )) : (
                                              <tr>
                                                <td className="py-3 px-4 text-gray-500 text-center" colSpan={6}>No enrolled courses</td>
                                              </tr>
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>

                                    {/* Status Message Between Enrolled and Available */}
                                    <div className={`px-3 py-2 rounded-md text-sm text-center ${requirementMetCat ? 'bg-green-50 text-green-800' : virtuallyMetWithRegisteredCat ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-700'}`}>
                                      {requirementMetCat
                                        ? 'All requirements for this category are met.'
                                        : `You need to complete ${coursesRemainingDisplay} more course(s) and ${creditsRemainingDisplay} more credit(s)${showExcluding ? ` , excluding ${registeredCount} registered course(s)` : '.'}`}
                                    </div>

                                    {/* Available Courses */}
                                    {!requirementMetCat && !virtuallyMetWithRegisteredCat && (
                                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
                                          📋 Available (Required) Courses
                                        </h4>
                                        <div className="overflow-x-auto">
                                          <table className="min-w-full text-sm bg-white rounded border border-orange-200">
                                            <thead className="bg-orange-100">
                                              <tr className="text-left text-orange-800">
                                                <th className="py-3 px-4 font-semibold">Code</th>
                                                <th className="py-3 px-4 font-semibold">Name</th>
                                                <th className="py-3 px-4 font-semibold">Credits</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {available.length > 0 ? available.map((c, i) => (
                                                <tr key={i} className="border-t border-orange-100 hover:bg-orange-25">
                                                  <td className="py-3 px-4 font-mono text-orange-900">{c.courseCode || '-'}</td>
                                                  <td className="py-3 px-4 text-gray-700">{c.courseName || '-'}</td>
                                                  <td className="py-3 px-4 text-gray-600">{c.credits ?? '-'}</td>
                                                </tr>
                                              )) : (
                                                <tr>
                                                  <td className="py-3 px-4 text-gray-500 text-center" colSpan={3}>No available courses</td>
                                                </tr>
                                              )}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                  {(!data.categoryProgress || data.categoryProgress.length === 0) && (
                    <div className="text-sm text-gray-500">No category progress data</div>
                  )}
                </div>
              </div>
              {/* Details moved inline within progress items for click-to-expand */}
            </motion.div>
          ) : null}
        </AnimatePresence>
      )}
    </div>
  );
};

export default AdminStudentReport;
