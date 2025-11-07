import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import DataTable from '../../components/admin/DataTable';

const AdminCategoryDetails = () => {
  const { user } = useAuth();
  const { selectedProgramId } = useProgramContext();
  const navigate = useNavigate();
  const { categoryName } = useParams();

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingCourse, setEditingCourse] = useState(null);
  const [formValues, setFormValues] = useState({ courseCode: '', courseTitle: '', courseCredits: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) {
      navigate('/login');
      return;
    }
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        // Load only courses for this category from backend
        const base = `${config.backendUrl}/api/v1/admin/data/courses/by-category`;
        const params = new URLSearchParams();
        params.append('categoryName', String(categoryName));
        if (user?.userType === 'ADMIN' && user?.programId) {
          params.append('programId', String(user.programId));
        } else if (user?.userType === 'SUPER_ADMIN' && selectedProgramId) {
          params.append('programId', String(selectedProgramId));
        }
        const res = await axios.get(`${base}?${params.toString()}`, { withCredentials: true });
        const list = Array.isArray(res.data) ? res.data : [];
        setCourses(list);
      } catch (e) {
        console.error(e);
        setError('Failed to load category details');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, navigate, categoryName, selectedProgramId]);

  // Navigate to course details on row click
  const handleRowClick = (row) => {
    const code = row?.courseCode || row?.code || row?.CourseCode || row?.id;
    if (code) {
      navigate(`/admin/courses/${encodeURIComponent(String(code))}`);
    }
  };

  const canManage = user?.userType === 'SUPER_ADMIN';
  const effectiveProgramId = canManage ? selectedProgramId : user?.programId;

  const openForm = (course = null) => {
    if (!canManage) return;
    if (!course) {
      setEditingCourse(null);
      setFormValues({ courseCode: '', courseTitle: '', courseCredits: '' });
    } else {
      setEditingCourse(course);
      setFormValues({
        courseCode: course.courseCode || '',
        courseTitle: course.courseTitle || '',
        courseCredits: course.courseCredits != null ? String(course.courseCredits) : ''
      });
    }
    setFormError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    if (formSubmitting) return;
    setFormOpen(false);
    setEditingCourse(null);
    setFormError('');
  };

  const onFormChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const reloadCourses = async () => {
    try {
      setLoading(true);
      setError('');
      const base = `${config.backendUrl}/api/v1/admin/data/courses/by-category`;
      const params = new URLSearchParams();
      params.append('categoryName', String(categoryName));
      if (user?.userType === 'ADMIN' && user?.programId) {
        params.append('programId', String(user.programId));
      } else if (user?.userType === 'SUPER_ADMIN' && selectedProgramId) {
        params.append('programId', String(selectedProgramId));
      }
      const res = await axios.get(`${base}?${params.toString()}`, { withCredentials: true });
      const list = Array.isArray(res.data) ? res.data : [];
      setCourses(list);
    } catch (e) {
      console.error(e);
      setError('Failed to load category details');
    } finally {
      setLoading(false);
    }
  };

  const submitForm = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    if (!effectiveProgramId) {
      setFormError('Select a program to manage category courses.');
      return;
    }
    const trimmedCode = formValues.courseCode.trim();
    const trimmedTitle = formValues.courseTitle.trim();
    const creditsValue = formValues.courseCredits.trim();
    if (!trimmedCode || !trimmedTitle) {
      setFormError('Course code and title are required.');
      return;
    }
    const numericCredits = creditsValue === '' ? null : Number(creditsValue);
    if (creditsValue !== '' && Number.isNaN(numericCredits)) {
      setFormError('Credits must be a number.');
      return;
    }

    try {
      setFormSubmitting(true);
      setFormError('');
      const base = `${config.backendUrl}/api/v1/admin/data/courses/by-category`;
      const params = new URLSearchParams();
      params.append('categoryName', String(categoryName));
      params.append('programId', String(effectiveProgramId));
      const payload = {
        courseCode: trimmedCode,
        courseTitle: trimmedTitle,
        courseCredits: numericCredits
      };
      if (editingCourse) {
        await axios.put(`${base}?${params.toString()}`, payload, { withCredentials: true });
      } else {
        await axios.post(`${base}?${params.toString()}`, payload, { withCredentials: true });
      }
      closeForm();
      await reloadCourses();
    } catch (err) {
      console.error(err);
      const message = err?.response?.data || 'Failed to save course';
      setFormError(typeof message === 'string' ? message : 'Failed to save course');
    } finally {
      setFormSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!canManage || !deleteTarget) return;
    if (!effectiveProgramId) {
      setError('Select a program to manage category courses.');
      setDeleteTarget(null);
      return;
    }
    try {
      const base = `${config.backendUrl}/api/v1/admin/data/courses/by-category`;
      const params = new URLSearchParams();
      params.append('categoryName', String(categoryName));
      params.append('programId', String(effectiveProgramId));
      params.append('courseCode', String(deleteTarget.courseCode));
      await axios.delete(`${base}?${params.toString()}`, { withCredentials: true });
      setDeleteTarget(null);
      await reloadCourses();
    } catch (err) {
      console.error(err);
      const message = err?.response?.data || 'Failed to delete course';
      setError(typeof message === 'string' ? message : 'Failed to delete course');
      setDeleteTarget(null);
    }
  };

  const columns = useMemo(() => {
    const baseCols = [
      { key: 'courseCode', header: 'Course Code', className: 'text-center' },
      { key: 'courseTitle', header: 'Course Title' },
      {
        key: 'courseCredits',
        className: 'text-center',
        header: 'Credits',
        render: (value) => (value != null ? value : '—'),
      }
    ];
    if (canManage) {
      baseCols.push({
        key: '__actions',
        header: 'Actions',
        render: (_, row) => (
          <div className="flex justify-center gap-2">
            <button
              type="button"
              className="btn px-3 py-1 border rounded hover:bg-gray-50"
              onClick={(e) => {
                e.stopPropagation();
                openForm(row);
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn px-3 py-1 border rounded text-red-600 hover:bg-red-50"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row);
              }}
            >
              Delete
            </button>
          </div>
        ),
        mobileHide: true,
      });
    }
    return baseCols;
  }, [canManage]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Category: {categoryName}</h2>
          <p className="text-sm text-gray-600">Courses and related insights</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              className="px-3 py-2 border rounded bg-red-900 text-white hover:bg-red-800 disabled:opacity-60"
              onClick={() => openForm()}
              disabled={!effectiveProgramId}
            >
              + Add Course
            </button>
          )}
          <button className="px-3 py-2 border rounded" onClick={() => navigate('/admin/categories')}>Back</button>
        </div>
      </div>

      {canManage && !effectiveProgramId && (
        <div className="p-3 border border-yellow-200 bg-yellow-50 rounded text-sm text-yellow-900">
          Select a program from the program picker to manage category courses.
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Courses in this category</h3>
        <DataTable
          columns={columns}
          rows={courses}
          onRowClick={handleRowClick}
          cardTitleKey="courseTitle"
          loading={loading}
          error={error}
          emptyText={loading ? '' : (error || 'No courses found')}
        />
      </div>

      {formOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingCourse ? 'Edit Course' : 'Add Course'}
              </h3>
              <button type="button" className="px-3 py-1 border rounded" onClick={closeForm} disabled={formSubmitting}>
                Close
              </button>
            </div>
            <form className="space-y-4" onSubmit={submitForm}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course Code</label>
                <input
                  name="courseCode"
                  value={formValues.courseCode}
                  onChange={onFormChange}
                  className="w-full border rounded px-3 py-2"
                  required
                  disabled={!!editingCourse}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course Title</label>
                <input
                  name="courseTitle"
                  value={formValues.courseTitle}
                  onChange={onFormChange}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credits</label>
                <input
                  name="courseCredits"
                  value={formValues.courseCredits}
                  onChange={onFormChange}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., 3"
                />
                <p className="text-xs text-gray-500 mt-1">Leave blank to use existing/default credits.</p>
              </div>
              {formError && (
                <div className="text-sm text-red-600">{formError}</div>
              )}
              <div className="flex justify-end gap-3">
                <button type="button" className="px-4 py-2 border rounded" onClick={closeForm} disabled={formSubmitting}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-900 text-white rounded hover:bg-red-800 disabled:opacity-60"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Delete Course</h3>
            <p className="text-sm text-gray-700">
              Are you sure you want to remove <span className="font-medium">{deleteTarget.courseTitle}</span> ({deleteTarget.courseCode}) from this category?
            </p>
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 border rounded" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCategoryDetails;
