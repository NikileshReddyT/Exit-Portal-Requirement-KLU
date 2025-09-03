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
  const [grades, setGrades] = useState([]);
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
        // Load student basic info from dedicated endpoint
        const sRes = await axios.get(`${config.backendUrl}/api/v1/admin/data/students/${encodeURIComponent(String(studentId))}` , { withCredentials: true });
        setStudent(sRes?.data || null);

        // Load grades for this student (course-wise list)
        const gradesRes = await axios.get(`${config.backendUrl}/api/v1/admin/data/grades?studentId=${encodeURIComponent(String(studentId))}`, { withCredentials: true });
        setGrades(Array.isArray(gradesRes.data) ? gradesRes.data : []);
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

  const gradesColumns = useMemo(() => ([
    { key: 'courseCode', header: 'Course Code' },
    { key: 'courseName', header: 'Course Name' },
    { key: 'credits', header: 'Credits', className: 'text-center' },
    { key: 'grade', header: 'Grade', className: 'text-center' },
    { key: 'gradePoint', header: 'Grade Point', className: 'text-center' },
    { key: 'promotion', header: 'Promotion', className: 'text-center' },
    { key: 'category', header: 'Category', },
    { key: 'year', header: 'Year', className: 'text-center' },
    { key: 'semester', header: 'Semester', className: 'text-center' },
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {metaPairs.map(([k, v]) => (
                <div key={k} className="text-sm ">
                  <div className="text-gray-500">{k}</div>
                  <div className="font-medium text-gray-900 break-words">{String(v)}</div>
                </div>
              ))}
              <div className="text-sm">
                <div className="text-gray-500">Degree</div>
                <div className="font-medium text-gray-900 break-words">Regular</div>
              </div>
            </div>
          </div>

          {/* Grades table */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Grades</h3>
            </div>
            <DataTable
              columns={gradesColumns}
              rows={grades}
              cardTitleKey="courseCode"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default AdminStudentDetails;

