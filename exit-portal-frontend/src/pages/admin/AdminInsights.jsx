import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import StatCard from '../../components/admin/StatCard';
import DataTable from '../../components/admin/DataTable';

const SectionCard = ({ title, children, right }) => (
  <div className="bg-white rounded-lg shadow p-4 sm:p-6">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {right}
    </div>
    {children}
  </div>
);

const Pill = ({ children, tone = 'default' }) => {
  const palette = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${palette[tone] || palette.default}`}>
      {children}
    </span>
  );
};

const StudentList = ({ title, students, emptyText, accent = 'default', onSelect, onExport, csvName }) => {
  const limited = students.slice(0, 6);
  const pulseTone = accent === 'success' ? 'text-green-700 bg-green-50' : accent === 'danger' ? 'text-red-700 bg-red-50' : 'text-gray-700 bg-gray-50';

  return (
    <div className="flex-1 min-w-[240px]">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-800">
          {title}
          <span className="ml-2 text-xs text-gray-500">({students.length})</span>
        </h4>
        {students.length > 0 && (
          <button
            type="button"
            onClick={() => onExport && onExport(students, csvName)}
            className="text-xs font-medium text-red-600 hover:text-red-700"
          >
            Export CSV
          </button>
        )}
      </div>
      {students.length === 0 ? (
        <div className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg px-3 py-4">{emptyText}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {limited.map((student) => (
            <div
              key={student.studentId}
              className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition cursor-pointer"
              onClick={() => onSelect && onSelect(student)}
            >
              <div className="flex items-center justify-between">
                <h5 className="font-medium text-gray-900 text-sm">{student.studentName || 'Unnamed'}</h5>
                {student.hasFailure ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">Has Failure</span>
                ) : (
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${pulseTone}`}>Clear</span>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-1">{student.studentId}</p>
            </div>
          ))}
          {students.length > limited.length && (
            <div className="text-xs text-gray-500 text-center py-2 bg-gray-50 rounded">
              Showing {limited.length} of {students.length}. Export CSV to view all.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

 

const formatNumber = (value) => {
  if (value == null) return '—';
  try {
    return Number(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const AdminHonorsInsights = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedProgramId, programInfo, setProgramContext } = useProgramContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [honorsData, setHonorsData] = useState(null);

  const urlParams = new URLSearchParams(location.search);
  const urlProgramId = urlParams.get('programId');
  const programId = selectedProgramId || urlProgramId;
  const isSuperAdmin = user?.userType === 'SUPER_ADMIN';
  const basePath = location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';

 

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) {
      navigate('/login');
      return;
    }

    let isCancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const params = new URLSearchParams();
        if (isSuperAdmin && programId) params.set('programId', programId);
        const query = params.toString();

        const honorsUrl = `${config.backendUrl}/api/v1/admin/insights/honors${query ? `?${query}` : ''}`;
        const [honorsRes] = await Promise.all([
          axios.get(honorsUrl, { withCredentials: true }),
        ]);

        if (isCancelled) return;
        setHonorsData(honorsRes.data || {});

        const effectiveProgramId = isSuperAdmin ? (programId || null) : (user?.programId || null);
        if (effectiveProgramId && (!programInfo || programInfo.programId != effectiveProgramId)) {
          try {
            const programRes = await axios.get(`${config.backendUrl}/api/v1/admin/programs/${effectiveProgramId}`, { withCredentials: true });
            if (!isCancelled) setProgramContext(effectiveProgramId, programRes.data);
          } catch (err) {
            console.warn('Failed to load program context', err);
          }
        }
      } catch (e) {
        if (!isCancelled) {
          console.error(e);
          setError('Failed to load honors insights');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    load();
    return () => {
      isCancelled = true;
    };
  }, [user, programId, isSuperAdmin, navigate, programInfo, setProgramContext]);

  

  const categories = useMemo(() => (
    Array.isArray(honorsData?.categories) ? honorsData.categories : []
  ), [honorsData]);

  const eligibleStudents = useMemo(() => (
    Array.isArray(honorsData?.eligibleStudents) ? honorsData.eligibleStudents : []
  ), [honorsData]);

  const honorsStudents = useMemo(() => (
    Array.isArray(honorsData?.honorsStudents) ? honorsData.honorsStudents : []
  ), [honorsData]);

  const failedButMetHonors = useMemo(() => (
    Array.isArray(honorsData?.failedButMetHonors) ? honorsData.failedButMetHonors : []
  ), [honorsData]);

  const achievedCohortCount = honorsStudents.length;
  const eligibleCohortCount = eligibleStudents.length;
  const failureCohortCount = failedButMetHonors.length;

  const handleStudentSelect = useCallback((student) => {
    if (!student?.studentId) return;
    const target = `${basePath}/students`;
    const params = new URLSearchParams();
    params.set('studentId', student.studentId);
    if (isSuperAdmin && programId) params.set('programId', programId);
    navigate(`${target}?${params}`);
  }, [navigate, basePath, isSuperAdmin, programId]);

  const handleExportCsv = useCallback((rows, filename) => {
    if (!rows?.length) return;
    const header = ['studentId', 'studentName', 'hasFailure'];
    const body = rows.map((row) => [row.studentId ?? '', (row.studentName ?? '').replaceAll('"', '""'), row.hasFailure ? 'true' : 'false']);
    const csv = [header.join(','), ...body.map((cols) => cols.map((col, idx) => idx === 1 ? `"${col}"` : col).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }, []);

  const cohortRows = useMemo(() => {
    const toRows = (arr, cohort) => (Array.isArray(arr) ? arr : []).map((s) => ({
      studentName: s.studentName || 'Unnamed',
      studentId: s.studentId,
      hasFailure: !!s.hasFailure,
      cohort,
    }));
    return [
      ...toRows(honorsStudents, 'Honors Achieved'),
      ...toRows(eligibleStudents, 'Eligible'),
      ...toRows(failedButMetHonors, 'Met Honors + Failure'),
    ];
  }, [honorsStudents, eligibleStudents, failedButMetHonors]);

  const [showAchieved, setShowAchieved] = useState(true);
  const [showEligible, setShowEligible] = useState(true);
  const [showFailure, setShowFailure] = useState(true);
  const filteredCohortRows = useMemo(() => {
    const filtered = cohortRows.filter((r) =>
      (r.cohort === 'Honors Achieved' && showAchieved) ||
      (r.cohort === 'Eligible' && showEligible) ||
      (r.cohort === 'Met Honors + Failure' && showFailure)
    );
    const order = { 'Honors Achieved': 0, 'Eligible': 1, 'Met Honors + Failure': 2 };
    return [...filtered].sort((a, b) => {
      const oa = order[a.cohort] ?? 99;
      const ob = order[b.cohort] ?? 99;
      if (oa !== ob) return oa - ob;
      const na = String(a.studentName || '');
      const nb = String(b.studentName || '');
      return na.localeCompare(nb);
    });
  }, [cohortRows, showAchieved, showEligible, showFailure]);

  const cohortColumns = useMemo(() => (
    [
      { key: 'studentName', label: 'Student', sortable: true },
      { key: 'studentId', label: 'ID', sortable: true },
      { key: 'cohort', label: 'Cohort', render: (val) => (val === 'Honors Achieved' ? <Pill tone="success">{val}</Pill> : val === 'Met Honors + Failure' ? <Pill tone="danger">{val}</Pill> : <Pill>{val}</Pill>) },
    ]
  ), []);

  const categoriesRows = useMemo(() => {
    return (Array.isArray(categories) ? categories : []).map((c) => ({
      ...c,
      // keep only counts; remove percentage derivations for simpler, useful insight
      metHonorsCount: c.metHonorsCount || 0,
      notMetHonorsCount: c.notMetHonorsCount || 0,
      metRegularCount: c.metRegularCount || 0,
    }));
  }, [categories]);

  const [showDiffersOnly, setShowDiffersOnly] = useState(false);

  const filteredCategoriesRows = useMemo(() => {
    if (!showDiffersOnly) return categoriesRows;
    return (categoriesRows || []).filter(r => !!r.differsFromRegular);
  }, [categoriesRows, showDiffersOnly]);

  const categoryColumnsDense = [
    { key: 'categoryName', label: 'Category', sortable: true },
    { key: 'minCredits', label: 'Min', render: (v) => formatNumber(v) },
    { key: 'honorsMinCredits', label: 'Honors Min', render: (v) => v != null ? formatNumber(v) : '—' },
    { key: 'metHonorsCount', label: 'Met Honors', render: (v) => formatNumber(v) },
    { key: 'metRegularCount', label: 'Met Regular', render: (v) => formatNumber(v) },
    { key: 'differsFromRegular', label: 'Differs', render: (val) => val ? <Pill tone="warning">Yes</Pill> : <Pill>No</Pill> },
  ];

  

  // removed card-based cohort lists in favor of a dense table below

  

  
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-700 mx-auto" />
          <p className="mt-4 text-gray-600">Loading honors insights...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">{error}</div>;
  }

  if (!honorsData?.hasHonorsConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Honors Insights</h2>
          <p className="text-sm text-gray-600">
            Configure honors minimum credits in the <button onClick={() => navigate('/admin/categories')} className="text-red-600 hover:underline">Categories</button> page to enable honors reporting.
          </p>
        </div>
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
          <p className="text-gray-700">
            No honors requirements have been set yet. Once honors minimum credits are defined, this page will show eligibility and completion insights.
          </p>
        </div>
      </div>
    );
  }

  return <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Honors Insights</h2>
        <p className="text-sm text-gray-600">
          Snapshot of honors eligibility{programInfo ? ` for ${programInfo.code}` : ''} across configured categories.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 items-stretch">
        <StatCard title="Students" value={honorsData?.totalStudents} color="purple" subtitle="Total in scope" />
        <StatCard title="No Failures" value={honorsData?.studentsWithoutFailure} color="blue" subtitle="Eligible pool" />
        <StatCard title="Honors-Eligible" value={honorsData?.eligibleCount} color="green" subtitle="Met diff categories" />
        <StatCard title="Honors Achieved" value={honorsData?.honorsAchieversCount} color="red" subtitle="Met all honors credits" />
      </div>

      <SectionCard title="Quick Actions">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/admin/categories')}
            className="px-3 py-2 border rounded-lg bg-white hover:bg-gray-50 text-left"
          >
            Manage Honors Requirements
          </button>
          <button
            onClick={() => {
              const params = new URLSearchParams();
              if (isSuperAdmin && programId) params.set('programId', programId);
              navigate(params.toString() ? `${basePath}/students?${params}` : `${basePath}/students`);
            }}
            className="px-3 py-2 border rounded-lg bg-white hover:bg-gray-50 text-left"
          >
            Open Student Directory
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="Student Cohorts"
        right={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAchieved((v) => !v)}
              className={`btn px-2 py-1 rounded-full text-xs font-medium border ${showAchieved ? 'bg-green-100 text-green-800 border-green-200' : 'bg-white text-gray-700 border-gray-200'}`}
              title="Toggle Achieved cohort"
            >
              Achieved {achievedCohortCount}
            </button>
            <button
              type="button"
              onClick={() => setShowEligible((v) => !v)}
              className={`btn px-2 py-1 rounded-full text-xs font-medium border ${showEligible ? 'bg-gray-100 text-gray-800 border-gray-200' : 'bg-white text-gray-700 border-gray-200'}`}
              title="Toggle Eligible cohort"
            >
              Eligible {eligibleCohortCount}
            </button>
            <button
              type="button"
              onClick={() => setShowFailure((v) => !v)}
              className={`btn px-2 py-1 rounded-full text-xs font-medium border ${showFailure ? 'bg-red-100 text-red-800 border-red-200' : 'bg-white text-gray-700 border-gray-200'}`}
              title="Toggle Met Honors + Failure cohort"
            >
              Failure {failureCohortCount}
            </button>
            
          </div>
        }
      >
        
        <DataTable
          rows={filteredCohortRows}
          columns={cohortColumns}
          onRowClick={(row) => handleStudentSelect({ studentId: row.studentId })}
          loading={false}
          error={null}
          emptyText="No students to show"
          enableSearch={true}
          enableColumnFilters={false}
          compact={true}
          cardTitleKey="studentName"
        />
      </SectionCard>

      <SectionCard
        title="Category Analysis"
        right={
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">Total {categoriesRows.length}</span>
            <span className="px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-800">Differs {categoriesRows.filter(r=>r.differsFromRegular).length}</span>
            <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Matches {categoriesRows.filter(r=>!r.differsFromRegular).length}</span>
            <button
              type="button"
              onClick={() => setShowDiffersOnly((v) => !v)}
              className={`btn px-2 py-1 rounded-full text-xs font-medium border ${showDiffersOnly ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-white text-gray-700 border-gray-200'}`}
            >
              Differs only
            </button>
          </div>
        }
      >
        <DataTable
          rows={filteredCategoriesRows}
          columns={categoryColumnsDense}
          loading={false}
          error={null}
          emptyText="No honors categories found"
          enableSearch={true}
          enableColumnFilters={false}
          compact={true}
        />
      </SectionCard>

    </div>;
};

export default AdminHonorsInsights;
