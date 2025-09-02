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
  const [studentName, setStudentName] = useState('');

  const load = async (overrideStudentId) => {
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
      const idToUse = typeof overrideStudentId === 'string' ? overrideStudentId : studentId;
      if (idToUse && idToUse.trim()) params.append('studentId', idToUse.trim());
      const url = params.toString() ? `${base}?${params}` : base;
      const res = await axios.get(url, { withCredentials: true });
      const list = Array.isArray(res.data) ? res.data : [];
      setRows(list);
      // Try to capture student's name from payload if present
      const first = list && list.length ? list[0] : null;
      const resolvedName = first?.studentName || first?.name || '';
      if (resolvedName) setStudentName(String(resolvedName));
    } catch (e) {
      console.error(e);
      setError('Failed to load progress');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) return;
    const params = new URLSearchParams(location.search);
    const sid = params.get('studentId') || '';
    setStudentId(sid);
    load(sid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, programId, location.search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Progress</h2>
          <p className="text-sm text-gray-600">
            {studentId?.trim() ? (
              <>Category progress for student <span className="font-semibold">{studentId.trim()}</span></>
            ) : (
              <>Track category/course completion across students</>
            )}
          </p>
        </div>
      </div>

      {/* Selected student details */}
      {studentId?.trim() && (
        <div className="bg-white rounded-lg shadow p-4 border border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="text-sm">
              <div className="text-gray-500">Student ID</div>
              <div className="font-medium text-gray-900 break-words">{studentId.trim()}</div>
            </div>
            <div className="text-sm">
              <div className="text-gray-500">Student Name</div>
              <div className="font-medium text-gray-900 break-words">{studentName || '—'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Build filtered columns excluding ids and program fields, enforce desired order */}
      <DataTable
        columns={useMemo(() => {
          if (!rows || rows.length === 0) return undefined;
          const excluded = new Set([
            // generic ids and student/program meta
            'id', 'ID', 'Id',
            'studentId', 'StudentId', 'studentID', 'StudentID',
            'studentName', 'StudentName',
            'programId', 'ProgramId', 'programID', 'ProgramID',
            'programName', 'ProgramName',
            'programCode', 'ProgramCode',
            // category/course/mapping/requirement/university id variants
            'categoryId', 'CategoryId', 'categoryID', 'CategoryID', 'category_id',
            'courseId', 'CourseId', 'courseID', 'CourseID', 'course_id',
            'requirementId', 'RequirementId', 'requirementID', 'RequirementID', 'requirement_id',
            'mappingId', 'MappingId', 'mappingID', 'MappingID', 'mapping_id',
            'universityId', 'UniversityId', 'universityID', 'UniversityID', 'university_id',
          ]);
          const isIdLike = (key) => {
            // Keep camelCase explicit endings; avoid catching words like 'grid'
            if (key.endsWith('Id') || key.endsWith('ID')) return true;
            // snake_case ids
            const lk = key.toLowerCase();
            if (lk.endsWith('_id')) return true;
            return false;
          };
          const allKeys = Object.keys(rows[0]).filter((k) => !excluded.has(k) && !isIdLike(k));
          const lowerToActual = new Map(allKeys.map((k) => [k.toLowerCase(), k]));
          const pick = (aliases) => {
            for (const a of aliases) {
              const found = lowerToActual.get(a.toLowerCase());
              if (found) return found;
            }
            return null;
          };
          const priorityAliases = [
            ['categoryName', 'category', 'category_name'],
            ['minCourses', 'minimumCourses', 'min_courses', 'minimum_courses'],
            ['completedCourses', 'completed_courses'],
            ['minCredits', 'minimumCredits', 'min_credits', 'minimum_credits'],
            ['completedCredits', 'completed_credits'],
          ];
          const ordered = [];
          const used = new Set();
          for (const aliases of priorityAliases) {
            const key = pick(aliases);
            if (key && !used.has(key)) {
              ordered.push(key);
              used.add(key);
            }
          }
          // Append remaining keys in original order
          for (const k of allKeys) if (!used.has(k)) ordered.push(k);
          return ordered.map((k) => ({ key: k, header: k }));
        }, [rows])}
        rows={rows}
        loading={loading}
        error={error}
        emptyText={loading ? '' : (error || 'No progress data found')}
        enableSearch={false}
        enableColumnFilters={false}
      />
    </div>
  );
};

export default AdminProgress;
