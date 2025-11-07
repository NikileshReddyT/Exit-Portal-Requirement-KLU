import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import StatCard from '../../components/admin/StatCard';
import { FiDownload, FiCheckCircle, FiXCircle, FiChevronDown, FiChevronUp, FiUser, FiAward, FiTrendingUp } from 'react-icons/fi';

const SectionCard = ({ title, children, right }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      {right}
    </div>
    {children}
  </div>
);

const ProgressBar = ({ completed, required, label }) => {
  const percentage = Math.min(100, (completed / required) * 100);
  const isMet = completed >= required;
  const gap = Math.max(0, required - completed);
  
  let color = 'bg-red-500';
  if (isMet) color = 'bg-green-500';
  else if (gap < 3) color = 'bg-amber-500';
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          {isMet ? (
            <FiCheckCircle className="text-green-600" size={18} />
          ) : (
            <FiXCircle className="text-red-600" size={18} />
          )}
          <span className={`text-sm font-bold ${isMet ? 'text-green-700' : 'text-red-700'}`}>
            {completed.toFixed(1)}/{required.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div className={`${color} h-3 rounded-full transition-all duration-300`} style={{ width: `${percentage}%` }}></div>
      </div>
      {!isMet && (
        <div className="text-xs text-red-600 font-medium">Short by {gap.toFixed(1)} credits</div>
      )}
    </div>
  );
};

const ExpandableStudentRow = ({ student, categories, onNavigate }) => {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  
  // Filter categories to show - ALWAYS show only honors diff categories by default
  const categoriesToShow = useMemo(() => {
    if (showAll) {
      return student.categoryGaps || [];
    }

    // For ALL students, show only honors diff categories by default
    return (student.categoryGaps || []).filter(g => g.differs);
  }, [student, showAll]);

  const cohortStyle = {
    'Honors Achieved': 'bg-green-100 text-green-700 border-green-300',
    'Eligible': 'bg-blue-100 text-blue-700 border-blue-300',
    'Honors Eligible + Failure': 'bg-red-100 text-red-700 border-red-300',
    'Not Eligible': 'bg-gray-100 text-gray-700 border-gray-300'
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all">
      <div 
        className="p-5 bg-white cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
              <FiUser className="text-white" size={22} />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-lg">{student.studentName}</div>
              <div className="text-sm text-gray-500 font-medium">{student.studentId}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded text-xs font-medium border ${cohortStyle[student.cohort] || cohortStyle['Not Eligible']}`}>
              {student.cohort}
            </span>
            {student.hasFailure && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600 border border-red-200">
                HAS FAILURE
              </span>
            )}
            {expanded ? <FiChevronUp className="text-gray-400" size={20} /> : <FiChevronDown className="text-gray-400" size={20} />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="bg-gradient-to-b from-gray-50 to-white p-6 border-t border-gray-200">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h4 className="font-bold text-gray-900">Honors Differencing Categories</h4>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAll(!showAll);
                }}
                className="btn px-3 py-1.5 text-xs font-semibold rounded-lg border-2 border-gray-300 hover:bg-gray-100 transition-colors"
              >
                {showAll ? 'Show Honors Diff Only' : 'Show All Categories'}
              </button>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(student);
              }}
              className="btn px-3 py-1.5 text-xs font-semibold rounded-lg border-2 border-gray-300 hover:bg-gray-100 transition-colors"
            >
              View Full Profile
            </button>
          </div>
          
          {categoriesToShow.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {showAll ? 'No categories to display' : 'All honors requirements met! 🎉'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {categoriesToShow.map((gap) => (
                <div key={gap.categoryName} className="bg-white p-4 rounded-lg border-2 border-gray-200 hover:border-red-300 transition-colors">
                  <ProgressBar
                    completed={gap.completed}
                    required={gap.honorsMin}
                    label={gap.categoryName}
                  />
                </div>
              ))}
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

  const failureEligibleHonors = useMemo(() => (
    Array.isArray(honorsData?.failureEligibleHonors)
      ? honorsData.failureEligibleHonors
      : Array.isArray(honorsData?.failedButMetHonors)
        ? honorsData.failedButMetHonors
        : []
  ), [honorsData]);

  const achievedCohortCount = honorsStudents.length;
  const eligibleCohortCount = eligibleStudents.length;
  const failureCohortCount = failureEligibleHonors.length;

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

  // Filter states
  const [showAchieved, setShowAchieved] = useState(true);
  const [showEligible, setShowEligible] = useState(true);
  const [showFailure, setShowFailure] = useState(true);
  const [showNotEligible, setShowNotEligible] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detailed students from backend
  const detailedStudents = useMemo(() => (
    Array.isArray(honorsData?.detailedStudentAnalysis) ? honorsData.detailedStudentAnalysis : []
  ), [honorsData]);

  const notEligibleCount = detailedStudents.filter(s => s.cohort === 'Not Eligible').length;

  // Filtered detailed students
  const filteredDetailedStudents = useMemo(() => {
    let filtered = detailedStudents.filter((s) => {
      const cohortMatch = 
        (s.cohort === 'Honors Achieved' && showAchieved) ||
        (s.cohort === 'Eligible' && showEligible) ||
        (s.cohort === 'Honors Eligible + Failure' && showFailure) ||
        (s.cohort === 'Not Eligible' && showNotEligible);
      
      if (!cohortMatch) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const nameMatch = (s.studentName || '').toLowerCase().includes(term);
        const idMatch = (s.studentId || '').toLowerCase().includes(term);
        if (!nameMatch && !idMatch) return false;
      }

      if (selectedCategory !== 'all') {
        const catGap = (s.categoryGaps || []).find(g => 
          g.categoryName.toLowerCase() === selectedCategory.toLowerCase()
        );
        if (!catGap || catGap.meetsHonors) return false;
      }

      return true;
    });

    const order = { 'Honors Achieved': 0, 'Eligible': 1, 'Honors Eligible + Failure': 2, 'Not Eligible': 3 };
    return [...filtered].sort((a, b) => {
      const oa = order[a.cohort] ?? 99;
      const ob = order[b.cohort] ?? 99;
      if (oa !== ob) return oa - ob;
      const na = String(a.studentName || '');
      const nb = String(b.studentName || '');
      return na.localeCompare(nb);
    });
  }, [detailedStudents, showAchieved, showEligible, showFailure, showNotEligible, searchTerm, selectedCategory]);

  // Pagination
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredDetailedStudents.slice(startIndex, endIndex);
  }, [filteredDetailedStudents, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredDetailedStudents.length / pageSize);

  const handleExportDetailedCsv = useCallback(() => {
    if (!detailedStudents?.length) return;
    
    // Helper to escape CSV fields properly
    const escapeCsvField = (field) => {
      if (field === null || field === undefined) return '""';
      const str = String(field);
      // Wrap in quotes and escape any internal quotes
      return `"${str.replaceAll('"', '""')}"`;
    };
    
    const categoryNames = categories.map(c => c.categoryName);
    const header = [
      'Student ID',
      'Student Name',
      'Cohort',
      'Has Failure',
      ...categoryNames.map(name => `${name} (Completed)`),
      ...categoryNames.map(name => `${name} (Required)`),
      ...categoryNames.map(name => `${name} (Gap)`)
    ];
    
    const body = detailedStudents.map(student => {
      const completedValues = categoryNames.map(name => {
        const gap = (student.categoryGaps || []).find(g => g.categoryName === name);
        return gap ? gap.completed.toFixed(1) : '0';
      });
      
      const requiredValues = categoryNames.map(name => {
        const gap = (student.categoryGaps || []).find(g => g.categoryName === name);
        return gap ? gap.honorsMin.toFixed(1) : '0';
      });
      
      const gapValues = categoryNames.map(name => {
        const gap = (student.categoryGaps || []).find(g => g.categoryName === name);
        return gap ? gap.honorsGap.toFixed(1) : '0';
      });
      
      return [
        student.studentId || '',
        student.studentName || '',
        student.cohort || '',
        student.hasFailure ? 'Yes' : 'No',
        ...completedValues,
        ...requiredValues,
        ...gapValues
      ];
    });
    
    // Escape all fields properly
    const csvHeader = header.map(escapeCsvField).join(',');
    const csvBody = body.map(row => row.map(escapeCsvField).join(',')).join('\n');
    const csv = csvHeader + '\n' + csvBody;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'honors_analysis_complete.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }, [detailedStudents, categories]);

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
        <h2 className="text-3xl font-bold text-gray-900">Honors Insights</h2>
        <p className="text-sm text-gray-600 mt-2">
          Comprehensive view of honors eligibility{programInfo ? ` for ${programInfo.code}` : ''}.
        </p>
      </div>

      {/* KPI Cards - Only Honors Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Honors Achieved" 
          value={honorsData?.honorsAchieversCount} 
          color="green" 
          subtitle="Met all honors requirements" 
        />
        <StatCard 
          title="Eligible for Honors" 
          value={honorsData?.eligibleCount} 
          color="blue" 
          subtitle="Met differencing categories" 
        />
        <StatCard 
          title="Honors Eligible + Failure" 
          value={honorsData?.failureEligibleHonorsCount ?? honorsData?.failedButMetHonorsCount} 
          color="red" 
          subtitle="Met honors diff requirements but has failures" 
        />
        <StatCard 
          title="Total Students" 
          value={honorsData?.totalStudents} 
          color="purple" 
          subtitle="In current scope" 
        />
      </div>

      {/* Student Analysis Section */}
      <SectionCard
        title="Student Analysis"
        right={
          <button
            onClick={handleExportDetailedCsv}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition-colors"
          >
            <FiDownload size={18} /> Export CSV
          </button>
        }
      >
        <div className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="🔍 Search by name or ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
            />
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 transition-all"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.categoryName} value={cat.categoryName}>
                  Failed: {cat.categoryName}
                </option>
              ))}
            </select>
          </div>

          {/* Cohort Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => {
                setShowAchieved(v => !v);
                setCurrentPage(1);
              }}
              className={`btn px-3 py-1.5 rounded text-sm font-medium border transition-all ${showAchieved ? 'bg-green-50 text-green-700 border-green-300' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
            >
              ✓ Achieved ({achievedCohortCount})
            </button>
            <button
              onClick={() => {
                setShowEligible(v => !v);
                setCurrentPage(1);
              }}
              className={`btn px-3 py-1.5 rounded text-sm font-medium border transition-all ${showEligible ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
            >
              ✓ Eligible ({eligibleCohortCount})
            </button>
            <button
              onClick={() => {
                setShowFailure(v => !v);
                setCurrentPage(1);
              }}
              className={`btn px-3 py-1.5 rounded text-sm font-medium border transition-all ${showFailure ? 'bg-red-50 text-red-700 border-red-300' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
            >
              ⚠ Honors Eligible + Failure ({failureCohortCount})
            </button>
            <button
              onClick={() => {
                setShowNotEligible(v => !v);
                setCurrentPage(1);
              }}
              className={`btn px-3 py-1.5 rounded text-sm font-medium border transition-all ${showNotEligible ? 'bg-gray-100 text-gray-700 border-gray-300' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
            >
              ✗ Not Eligible ({notEligibleCount})
            </button>
            <button
              onClick={() => {
                setShowAchieved(true);
                setShowEligible(true);
                setShowFailure(true);
                setShowNotEligible(true);
                setSearchTerm('');
                setSelectedCategory('all');
                setCurrentPage(1);
              }}
              className="btn px-4 py-2 rounded-lg font-semibold bg-gray-300 text-gray-800 hover:bg-gray-400 transition-colors"
            >
              Reset Filters
            </button>
            <div className="ml-auto text-sm font-semibold text-gray-600">
              Showing {filteredDetailedStudents.length} students
            </div>
          </div>

          {/* Student List */}
          <div className="space-y-4">
            {filteredDetailedStudents.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No students match the current filters
              </div>
            ) : (
              <>
                {paginatedStudents.map((student) => (
                  <ExpandableStudentRow
                    key={student.studentId}
                    student={student}
                    categories={categories}
                    onNavigate={handleStudentSelect}
                  />
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-6 border-t-2 border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Rows per page:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="px-3 py-2 border-2 border-gray-300 rounded-lg font-semibold"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-700">
                        Page {currentPage} of {totalPages}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          className="px-4 py-2 border-2 border-gray-300 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                        >
                          First
                        </button>
                        <button
                          onClick={() => setCurrentPage(p => p - 1)}
                          disabled={currentPage === 1}
                          className="px-4 py-2 border-2 border-gray-300 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setCurrentPage(p => p + 1)}
                          disabled={currentPage === totalPages}
                          className="px-4 py-2 border-2 border-gray-300 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                        >
                          Next
                        </button>
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                          className="px-4 py-2 border-2 border-gray-300 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                        >
                          Last
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Category Analysis - Clean & Functional */}
      <SectionCard 
        title="Category Requirements Analysis"
        right={
          <button
            onClick={() => {
              if (categories.length === 0) {
                alert('No categories to export.');
                return;
              }
              
              // Helper to escape CSV fields
              const escapeCsvField = (field) => {
                if (field === null || field === undefined) return '""';
                const str = String(field);
                return `"${str.replaceAll('"', '""')}"`;
              };
              
              const header = ['Category', 'Regular Min', 'Honors Min', 'Met', 'Not Met', 'Success Rate', 'Status'];
              const rows = categories.map(c => {
                const total = (c.metHonorsCount || 0) + (c.notMetHonorsCount || 0);
                const rate = total > 0 ? ((c.metHonorsCount || 0) / total * 100).toFixed(0) : 0;
                return [
                  c.categoryName,
                  c.minCredits?.toFixed(1) || '',
                  c.honorsMinCredits?.toFixed(1) || '',
                  c.metHonorsCount || 0,
                  c.notMetHonorsCount || 0,
                  `${rate}%`,
                  c.differsFromRegular ? 'DIFFERS' : 'Same'
                ];
              });
              
              const csvHeader = header.map(escapeCsvField).join(',');
              const csvBody = rows.map(row => row.map(escapeCsvField).join(',')).join('\n');
              const csv = csvHeader + '\n' + csvBody;
              
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = 'category_analysis.csv';
              link.click();
              URL.revokeObjectURL(link.href);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm transition-colors"
          >
            <FiDownload size={16} /> Export Categories CSV
          </button>
        }
      >
        <div className="space-y-6">
          {/* Summary Stats - Actionable Insights */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">{categories.length}</div>
              <div className="text-sm text-gray-600 mt-1 font-medium">Total Categories</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-600">{categories.filter(c => c.differsFromRegular).length}</div>
              <div className="text-sm text-gray-600 mt-1 font-medium">Honors Differs</div>
            </div>
            <div className="text-center">
              {(() => {
                const avgRate = categories.reduce((sum, c) => {
                  const total = (c.metHonorsCount || 0) + (c.notMetHonorsCount || 0);
                  const rate = total > 0 ? ((c.metHonorsCount || 0) / total) * 100 : 0;
                  return sum + rate;
                }, 0) / (categories.length || 1);
                const color = avgRate >= 75 ? 'text-green-600' : avgRate >= 60 ? 'text-amber-600' : 'text-red-600';
                return (
                  <>
                    <div className={`text-3xl font-bold ${color}`}>{avgRate.toFixed(0)}%</div>
                    <div className="text-sm text-gray-600 mt-1 font-medium">Avg Success Rate</div>
                  </>
                );
              })()}
            </div>
            <div className="text-center">
              {(() => {
                const problemCount = categories.filter(c => {
                  const total = (c.metHonorsCount || 0) + (c.notMetHonorsCount || 0);
                  const rate = total > 0 ? ((c.metHonorsCount || 0) / total) * 100 : 0;
                  return rate < 60;
                }).length;
                return (
                  <>
                    <div className="text-3xl font-bold text-red-600">{problemCount}</div>
                    <div className="text-sm text-gray-600 mt-1 font-medium">At Risk (&lt;60%)</div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Detailed Category Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="text-left p-4 font-bold text-gray-900">Category</th>
                  <th className="text-center p-4 font-bold text-gray-900">Regular Min</th>
                  <th className="text-center p-4 font-bold text-gray-900">Honors Min</th>
                  <th className="text-center p-4 font-bold text-gray-900">Status</th>
                  <th className="text-center p-4 font-bold text-green-700">Met Honors</th>
                  <th className="text-center p-4 font-bold text-red-700">Not Met</th>
                  <th className="text-center p-4 font-bold text-gray-900">Success Rate</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Calculate average for comparison
                  const avgSuccessRate = categories.reduce((sum, c) => {
                    const total = (c.metHonorsCount || 0) + (c.notMetHonorsCount || 0);
                    const rate = total > 0 ? ((c.metHonorsCount || 0) / total) * 100 : 0;
                    return sum + rate;
                  }, 0) / (categories.length || 1);
                  
                  return categories
                    .sort((a, b) => {
                      // Sort by success rate (lowest first to highlight problems)
                      const totalA = (a.metHonorsCount || 0) + (a.notMetHonorsCount || 0);
                      const totalB = (b.metHonorsCount || 0) + (b.notMetHonorsCount || 0);
                      const rateA = totalA > 0 ? (a.metHonorsCount || 0) / totalA : 0;
                      const rateB = totalB > 0 ? (b.metHonorsCount || 0) / totalB : 0;
                      return rateA - rateB;
                    })
                    .map((cat, idx) => {
                      const total = (cat.metHonorsCount || 0) + (cat.notMetHonorsCount || 0);
                      const successRate = total > 0 ? ((cat.metHonorsCount || 0) / total * 100) : 0;
                      const isExcellent = successRate >= 90;
                      const isGood = successRate >= 75 && successRate < 90;
                      const isAtRisk = successRate >= 50 && successRate < 60;
                      const isCritical = successRate < 50;
                      const isAboveAvg = successRate > avgSuccessRate;
                      
                      let bgColor = '';
                      if (isCritical) bgColor = 'bg-red-50';
                      else if (isAtRisk) bgColor = 'bg-orange-50';
                      else if (isExcellent) bgColor = 'bg-green-50';
                      
                      return (
                        <tr 
                          key={cat.categoryName} 
                          className={`border-b border-gray-200 hover:shadow-md transition-all ${bgColor}`}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900">{cat.categoryName}</span>
                              {isCritical && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-medium rounded border border-red-300">Critical</span>
                              )}
                              {isAtRisk && !isCritical && (
                                <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-medium rounded border border-orange-300">At Risk</span>
                              )}
                              {isExcellent && (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded border border-green-300">Excellent</span>
                              )}
                            </div>
                          </td>
                        <td className="text-center p-4 text-gray-700">{cat.minCredits?.toFixed(1) || '—'}</td>
                        <td className="text-center p-4 font-semibold text-gray-900">{cat.honorsMinCredits?.toFixed(1) || '—'}</td>
                        <td className="text-center p-4">
                          {cat.differsFromRegular ? (
                            <span className="inline-block px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded border border-amber-200">
                              Differs
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-1 bg-gray-50 text-gray-600 text-xs font-normal rounded">
                              Same
                            </span>
                          )}
                        </td>
                        <td className="text-center p-4">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-2xl font-bold text-green-700">{cat.metHonorsCount || 0}</span>
                            <span className="text-xs text-gray-600">students</span>
                          </div>
                        </td>
                        <td className="text-center p-4">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-2xl font-bold text-red-700">{cat.notMetHonorsCount || 0}</span>
                            <span className="text-xs text-gray-600">students</span>
                          </div>
                        </td>
                        <td className="text-center p-4">
                          <div className="flex flex-col items-center gap-2">
                            <span className={`text-xl font-bold ${successRate >= 75 ? 'text-green-700' : successRate >= 50 ? 'text-amber-600' : 'text-red-700'}`}>
                              {successRate.toFixed(0)}%
                            </span>
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all ${successRate >= 75 ? 'bg-green-500' : successRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${successRate}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-medium rounded border border-red-300">Critical</span>
              <span className="text-xs text-gray-600">&lt;50% success</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-medium rounded border border-orange-300">At Risk</span>
              <span className="text-xs text-gray-600">50-59% success</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded border border-green-300">Excellent</span>
              <span className="text-xs text-gray-600">≥90% success</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded border border-amber-200">Differs</span>
              <span className="text-xs text-gray-600">Honors differs from regular</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-50 border border-red-200 rounded"></div>
              <span className="text-xs text-gray-600">Red background = Critical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-50 border border-green-200 rounded"></div>
              <span className="text-xs text-gray-600">Green background = Excellent</span>
            </div>
          </div>
        </div>
      </SectionCard>

    </div>;
};

export default AdminHonorsInsights;
