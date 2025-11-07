import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLoader, FiAlertTriangle, FiChevronDown, FiChevronRight, FiRefreshCw, FiDownload, FiUser } from 'react-icons/fi';
import PdfDownloadButton from '../../components/ui/PdfDownloadButton';

// Circular Progress Component
const CircularProgress = ({ value, total, label, color = 'blue', showPercentage = false }) => {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const colorClasses = {
    green: { stroke: 'stroke-green-600', text: 'text-green-600', bg: 'stroke-gray-200' },
    yellow: { stroke: 'stroke-amber-500', text: 'text-amber-500', bg: 'stroke-gray-200' },
    blue: { stroke: 'stroke-blue-600', text: 'text-blue-600', bg: 'stroke-gray-200' },
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg className="transform -rotate-90 w-36 h-36">
          <circle
            cx="72"
            cy="72"
            r="54"
            className={`${colors.bg} fill-none`}
            strokeWidth="8"
          />
          <motion.circle
            cx="72"
            cy="72"
            r="54"
            className={`${colors.stroke} fill-none`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${colors.text}`}>
            {showPercentage ? `${Math.round(percentage)}%` : value}
          </span>
          {!showPercentage && (
            <span className="text-sm text-gray-500">of {total}</span>
          )}
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold text-gray-700 text-center">{label}</p>
    </div>
  );
};

const AdminStudentReport = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
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

  // Registered detection: ONLY when promotion is 'R'
  const isRegistered = (c) => {
    const promo = (c.promotion ?? '').toString().toUpperCase();
    return promo === 'R';
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
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="cursor-pointer hover:text-brand-red" onClick={() => navigate('/admin/dashboard')}>Dashboard</span>
          <FiChevronRight size={14} />
          <span className="cursor-pointer hover:text-brand-red" onClick={() => navigate('/admin/students')}>Students</span>
          <FiChevronRight size={14} />
          <span className="text-gray-900 font-medium">{data?.studentName || studentId || 'Student'}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Header with Download Button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Student Academic Report</h1>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <FiRefreshCw className={loading ? 'animate-spin' : ''} size={16} />
              <span className="text-sm font-medium">Refresh</span>
            </motion.button>
            {studentId && <PdfDownloadButton studentId={studentId} wrapperClassName="flex items-center" />}
          </div>
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
              {/* Student Info Card */}
              <motion.div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-start gap-6">
                  {/* Avatar */}
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0">
                    <FiUser size={32} className="text-blue-600" />
                  </div>

                  {/* Student Details Grid */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="text-lg font-bold text-gray-900">{data.studentName || '—'}</div>
                      <div className="text-sm text-gray-600">Student ID: <span className="font-semibold">{data.studentId || studentId}</span></div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">CGPA</div>
                      <div className="text-lg font-bold text-gray-900">
                        {(() => {
                          // CGPA Calculation per KLU policy:
                          // Include ALL attempted (non-registered) courses in numerator and denominator.
                          // Numerator: sum((gradePoint || 0) * credits) for promotion !== 'R'
                          // Denominator: sum(credits) for promotion !== 'R'
                          // Java-style rounding at 2 decimals.
                          const allCourses = (data.categories || []).flatMap(cat => (cat.courses || []));
                          const attempts = allCourses.filter(c => String(c.promotion || '').toUpperCase() !== 'R' && c.credits != null);

                          if (attempts.length === 0) return '—';

                          const totalWeightedPoints = attempts.reduce((sum, c) => sum + ((Number(c.gradePoint ?? 0)) * Number(c.credits)), 0);
                          const denomCredits = attempts.reduce((sum, c) => sum + Number(c.credits), 0);

                          if (denomCredits === 0) return '0.00 / 10.0';

                          const rawCgpa = totalWeightedPoints / denomCredits;
                          const cgpa = (Math.floor(rawCgpa * 100 + 0.5) / 100).toFixed(2);
                          return `${cgpa} / 10.0`;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Circular Progress Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div 
                  className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <CircularProgress
                    value={totals.totalCompletedCourses}
                    total={totals.totalReqCourses}
                    label="Courses Completed"
                    color="green"
                  />
                </motion.div>
                <motion.div 
                  className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <CircularProgress
                    value={totals.totalCompletedCredits}
                    total={totals.totalReqCredits}
                    label="Credits Earned"
                    color="yellow"
                  />
                </motion.div>
                <motion.div 
                  className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <CircularProgress
                    value={Math.round(totals.pctCredits)}
                    total={100}
                    label="Overall Progress"
                    color="blue"
                    showPercentage
                  />
                </motion.div>
              </div>

              {/* Category Progress Summary with hover tooltip and expandable details */}
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Category Progress</h3>
                </div>
                <div className="space-y-3">
                  {(data.categoryProgress || [])
                    .map((cp) => {
                      // Calculate status first for sorting (registered strictly by promotion 'R')
                      const reqC = Number(cp.minRequiredCourses) || 0;
                      const doneC = Number(cp.completedCourses) || 0;
                      const reqCr = Number(cp.minRequiredCredits) || 0;
                      const doneCr = Number(cp.completedCredits) || 0;
                      const cat = categoriesByName.get(cp.categoryName);
                      const regList = (cat?.courses || []).filter(c => String(c.promotion || '').toUpperCase() === 'R');
                      const actualRegC = regList.length;
                      const actualRegCr = regList.reduce((s, c) => s + (Number(c.credits) || 0), 0);
                      const requirementMet = (doneC >= reqC) && (doneCr >= reqCr);
                      const onTrack = !requirementMet && (doneC + actualRegC) >= reqC && (doneCr + actualRegCr) >= reqCr;
                      const statusOrder = requirementMet ? 3 : onTrack ? 2 : 1; // 1=At Risk, 2=On Track, 3=Complete
                      return { ...cp, statusOrder, actualRegC, actualRegCr };
                    })
                    .sort((a, b) => a.statusOrder - b.statusOrder) // Sort: At Risk → On Track → Complete
                    .map((cp, idx) => {
                    const reqC = Number(cp.minRequiredCourses) || 0;
                    const doneC = Number(cp.completedCourses) || 0;
                    const reqCr = Number(cp.minRequiredCredits) || 0;
                    const doneCr = Number(cp.completedCredits) || 0;
                    // Resolve category once
                    const cat = categoriesByName.get(cp.categoryName);
                    // Registered strictly by promotion 'R'
                    const regList = (cat?.courses || []).filter(c => String(c.promotion || '').toUpperCase() === 'R');
                    const actualRegC = regList.length;
                    const actualRegCr = regList.reduce((s, c) => s + (Number(c.credits) || 0), 0);
                    const pctComplete = reqC > 0 ? (doneC / reqC) * 100 : 100;
                    // Total progress includes both completed and registered
                    const totalPct = reqC > 0 ? ((doneC + actualRegC) / reqC) * 100 : 0;

                    const requirementMet = (doneC >= reqC) && (doneCr >= reqCr);
                    const remainingCourses = Math.max(0, reqC - doneC - actualRegC);
                    const remainingCredits = Math.max(0, reqCr - doneCr - actualRegCr);
                    const showRegistered = actualRegC > 0 && !requirementMet;
                    const onTrack = !requirementMet && (doneC + actualRegC) >= reqC && (doneCr + actualRegCr) >= reqCr;

                    return (
                      <motion.div
                        key={cp.categoryName || idx}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="border-2 border-gray-200 rounded-2xl p-6 hover:shadow-lg hover:border-gray-300 transition-all cursor-pointer bg-white"
                        onClick={() => setExpandedCategory(prev => prev === cp.categoryName ? null : cp.categoryName)}
                      >
                        {/* Header Row with Credits - Larger */}
                        <div className="space-y-3 mb-3">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="text-lg font-bold text-gray-900">{cp.categoryName}</div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                                requirementMet 
                                  ? 'bg-green-100 text-green-700'
                                  : onTrack
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-red-50 text-red-700'
                              }`}>
                                {requirementMet ? '✓' : onTrack ? '⌛' : '⚠'}
                              </span>
                              <FiChevronDown 
                                className={`transition-transform text-gray-400 ${expandedCategory === cp.categoryName ? 'rotate-180' : ''}`} 
                                size={20}
                              />
                            </div>
                          </div>
                          {/* Stats Row - Larger */}
                          <div className="flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-600 font-medium">Courses:</span>
                              <span className="font-bold text-green-700">{doneC}</span>
                              {showRegistered && <span className="text-amber-600 font-bold">+ {actualRegC}</span>}
                              <span className="text-gray-500">/ {reqC}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-600 font-medium">Credits:</span>
                              <span className="font-bold text-green-700">{doneCr}</span>
                              {showRegistered && <span className="text-amber-600 font-bold">+ {actualRegCr}</span>}
                              <span className="text-gray-500">/ {reqCr}</span>
                            </div>
                            {remainingCourses > 0 && (
                              <span className="text-red-600 font-bold ml-auto">{remainingCourses} left</span>
                            )}
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="relative">
                          <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden relative">
                            {/* Yellow bar for total (completed + registered) - only show if registered exists */}
                            {showRegistered && (
                              <motion.div
                                className="absolute left-0 top-0 h-2.5 bg-amber-400 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, totalPct)}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                              />
                            )}
                            {/* Green bar for completed - overlays yellow */}
                            <motion.div
                              className="absolute left-0 top-0 h-2.5 bg-green-600 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, pctComplete)}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                            />
                          </div>
                          {/* Stats below bar */}
                          <div className="flex justify-between items-center mt-2 text-sm text-gray-700">
                            <span className="font-semibold">{Math.round(pctComplete)}% done{showRegistered && ` • ${Math.round(totalPct)}% total`}</span>
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
                                const isRegistered = (c) => String(c.promotion || '').toUpperCase() === 'R';
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
    </div>
  );
};

export default AdminStudentReport;
