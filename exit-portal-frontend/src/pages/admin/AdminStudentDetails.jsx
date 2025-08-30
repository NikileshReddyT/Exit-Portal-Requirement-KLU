import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/admin/DataTable';

const AdminStudentDetails = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { studentId } = useParams();

  const [student, setStudent] = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) {
      navigate('/login');
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        // Load student basic info from students list (until there is a dedicated endpoint)
        const studentsRes = await axios.get(`${config.backendUrl}/api/v1/admin/data/students`, { withCredentials: true });
        const list = Array.isArray(studentsRes.data) ? studentsRes.data : [];
        const found = list.find(s => String(s.universityId || s.studentId || s.id) === String(studentId));
        setStudent(found || null);

        // Load detailed progress for this student
        const params = new URLSearchParams();
        params.append('studentId', String(studentId));
        const progRes = await axios.get(`${config.backendUrl}/api/v1/admin/data/progress?${params.toString()}`, { withCredentials: true });
        setProgress(Array.isArray(progRes.data) ? progRes.data : []);
      } catch (e) {
        console.error(e);
        setError('Failed to load student details');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, navigate, studentId]);

  const metaPairs = useMemo(() => {
    const s = student || {};
    const pairs = [
      ['University ID', s.universityId || s.studentId || s.id],
      ['Name', s.name || s.studentName],
      ['Program', s.programName || s.program || s.programCode],
      ['Email', s.email],
      ['Status', s.status || s.currentStatus],
    ];
    return pairs.filter(([_, v]) => v != null && v !== '');
  }, [student]);

  const progressColumns = useMemo(() => ([
    { key: 'categoryName', header: 'Category' },
    { key: 'minRequiredCourses', header: 'Min Required Courses' },
    { key: 'completedCourses', header: 'Completed Courses' },
    { key: 'minRequiredCredits', header: 'Min Required Credits' },
    { key: 'completedCredits', header: 'Completed Credits' },
  ]), []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Student Details</h2>
          <p className="text-sm text-gray-600">Insights for student {studentId}</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 border rounded" onClick={() => navigate('/admin/students')}>Back</button>
        </div>
      </div>

      {loading ? (
        <div className="min-h-[30vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-900" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">{error}</div>
      ) : (
        <>
          {/* Bio */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {metaPairs.map(([k, v]) => (
                <div key={k} className="text-sm">
                  <div className="text-gray-500">{k}</div>
                  <div className="font-medium text-gray-900 break-words">{String(v)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress table */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Progress</h3>
            </div>
            <DataTable
              columns={progressColumns}
              rows={progress}
              onRowClick={(row) => {
                const cat = row?.categoryName ? encodeURIComponent(row.categoryName) : '';
                navigate(`/admin/grades?studentId=${encodeURIComponent(String(studentId))}&category=${cat}`);
              }}
              cardTitleKey="categoryName"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default AdminStudentDetails;
