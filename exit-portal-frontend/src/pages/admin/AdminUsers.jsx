import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProgramContext } from '../../context/ProgramContext';
import axios from 'axios';
import config from '../../config';
import Breadcrumbs from '../../components/ui/Breadcrumbs';

const AdminUsers = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedProgramId } = useProgramContext();
  
  // Get programId from URL params or context
  const urlParams = new URLSearchParams(location.search);
  const urlProgramId = urlParams.get('programId');
  const programId = selectedProgramId || urlProgramId;

  const [admins, setAdmins] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // admin object
  const [editForm, setEditForm] = useState({ name: '', password: '', role: 'ADMIN', programId: '', enabled: true });
  const [deletingId, setDeletingId] = useState(null);

  const [form, setForm] = useState({
    username: '',
    name: '',
    password: '',
    role: 'ADMIN',
    programId: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || user.userType !== 'SUPER_ADMIN') {
      navigate('/login');
      return;
    }
    loadData();
  }, [user, navigate, programId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Build API URL with programId if available for filtering admin users
      const adminUrl = programId 
        ? `${config.backendUrl}/api/v1/admin/admin-users?programId=${programId}`
        : `${config.backendUrl}/api/v1/admin/admin-users`;
      
      const [adminsRes, progsRes] = await Promise.all([
        axios.get(adminUrl, { withCredentials: true }),
        axios.get(`${config.backendUrl}/api/v1/admin/programs`, { withCredentials: true })
      ]);
      setAdmins(adminsRes.data || []);
      setPrograms(progsRes.data || []);
    } catch (e) {
      console.error(e);
      setError('Failed to load admin users');
    } finally {
      setLoading(false);
    }
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const openEdit = (admin) => {
    // Determine the program id from multiple possible shapes
    const rawProgramId = (admin && admin.program && admin.program.id != null)
      ? admin.program.id
      : (admin && admin.program && admin.program.programId != null)
        ? admin.program.programId
        : (admin && admin.programId != null)
          ? admin.programId
          : null;
    const computedProgramId = rawProgramId != null ? String(rawProgramId) : '';

    // Helpful diagnostics to debug preselection issues
    try {
      // Log admin object and computed values
      // Note: Remove these logs if too noisy in production
      console.log('[AdminUsers] openEdit admin:', admin);
      console.log('[AdminUsers] rawProgramId:', rawProgramId, 'computedProgramId:', computedProgramId, 'role:', admin?.role);
      const programListBrief = programs.map(p => ({ id: p.id, code: p.code }));
      console.log('[AdminUsers] programs in state:', programListBrief);
      const existsInList = programListBrief.some(p => String(p.id) === computedProgramId);
      if (computedProgramId && !existsInList) {
        console.warn('[AdminUsers] Computed programId not found in programs list:', computedProgramId);
      }
    } catch (_) {
      // ignore logging errors
    }

    setEditing(admin);
    setEditForm({
      name: admin.name || '',
      password: '',
      role: admin.role || 'ADMIN',
      programId: computedProgramId,
      enabled: admin.enabled !== false
    });
  };

  const onEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    try {
      const payload = {
        name: editForm.name.trim(),
        password: editForm.password ? editForm.password : null,
        role: editForm.role,
        programId: editForm.role === 'ADMIN' ? Number(editForm.programId) : (editForm.programId ? Number(editForm.programId) : null),
        enabled: !!editForm.enabled
      };
      await axios.put(`${config.backendUrl}/api/v1/admin/admin-users/${editing.id}`, payload, { withCredentials: true });
      setEditing(null);
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data || 'Failed to update admin');
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await axios.delete(`${config.backendUrl}/api/v1/admin/admin-users/${deletingId}`, { withCredentials: true });
      setDeletingId(null);
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data || 'Failed to delete admin');
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        username: form.username.trim(),
        name: form.name.trim(),
        password: form.password,
        role: form.role,
        programId: form.role === 'ADMIN' ? Number(form.programId) : (form.programId ? Number(form.programId) : null)
      };
      await axios.post(`${config.backendUrl}/api/v1/admin/admin-users`, payload, { withCredentials: true });
      setForm({ username: '', name: '', password: '', role: 'ADMIN', programId: programId || '' });
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data || 'Failed to create admin');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin users...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={loadData} className="px-4 py-2 bg-red-900 text-white rounded hover:bg-red-800">Retry</button>
        </div>
      </div>
    );
  }

  const crumbs = user?.userType === 'SUPER_ADMIN'
    ? [ { label: 'Super Admin', to: '/superadmin/dashboard' }, { label: 'Admin Users' } ]
    : [ { label: 'Admin', to: '/admin/dashboard' }, { label: 'Admin Users' } ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Admin Users</h1>
            <button className="px-4 py-2 border rounded" onClick={() => navigate('/admin/dashboard')}>Back to Dashboard</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4">
          <Breadcrumbs items={crumbs} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Existing Admins</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enabled</th>
                    <th className="px-4 py-2 text-left"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {admins.map(a => (
                    <tr key={a.id}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{a.username}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{a.name}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{a.role}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{a.program ? `${a.program.code} - ${a.program.name}` : '-'}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{a.enabled ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-right space-x-2">
                        <button onClick={() => openEdit(a)} className="px-3 py-1 border rounded hover:bg-gray-50">Edit</button>
                        <button onClick={() => setDeletingId(a.id)} className="px-3 py-1 border rounded text-red-700 hover:bg-red-50">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create form */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Admin</h2>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input name="username" value={form.username} onChange={onChange} className="w-full border rounded px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input name="name" value={form.name} onChange={onChange} className="w-full border rounded px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" name="password" value={form.password} onChange={onChange} className="w-full border rounded px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select name="role" value={form.role} onChange={onChange} className="w-full border rounded px-3 py-2">
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
                <select name="programId" value={form.programId} onChange={onChange} className="w-full border rounded px-3 py-2" disabled={form.role !== 'ADMIN'}>
                  <option value="">{form.role === 'ADMIN' ? '-- Select a program --' : '(optional)'}</option>
                  {programs.map(p => (
                    <option key={p.id} value={String(p.id)}>{p.code} - {p.name}</option>
                  ))}
                </select>
                {form.role === 'ADMIN' && (
                  <p className="text-xs text-gray-500 mt-1">Required for ADMIN role</p>
                )}
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-red-900 text-white rounded hover:bg-red-800 disabled:opacity-50">{submitting ? 'Creating...' : 'Create Admin'}</button>
                <button type="button" onClick={() => setForm({ username: '', name: '', password: '', role: 'ADMIN', programId: '' })} className="px-4 py-2 border rounded">Clear</button>
              </div>
            </form>
          </div>
        </div>

        {/* Edit Modal */}
        {editing && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Admin: {editing.username}</h3>
              <form className="space-y-4" onSubmit={submitEdit}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input name="name" value={editForm.name} onChange={onEditChange} className="w-full border rounded px-3 py-2" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password (optional)</label>
                  <input type="password" name="password" value={editForm.password} onChange={onEditChange} className="w-full border rounded px-3 py-2" placeholder="Leave blank to keep existing" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select name="role" value={editForm.role} onChange={onEditChange} className="w-full border rounded px-3 py-2">
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
                  <select name="programId" value={editForm.programId} onChange={onEditChange} className="w-full border rounded px-3 py-2" disabled={editForm.role !== 'ADMIN'}>
                    <option value="">{editForm.role === 'ADMIN' ? '-- Select a program --' : '(optional)'}</option>
                    {programs.map(p => (
                      <option key={p.id} value={String(p.id)}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                  {editForm.role === 'ADMIN' && (
                    <p className="text-xs text-gray-500 mt-1">Required for ADMIN role</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input id="enabledToggle" type="checkbox" name="enabled" checked={!!editForm.enabled} onChange={onEditChange} />
                  <label htmlFor="enabledToggle" className="text-sm text-gray-700">Enabled</label>
                </div>
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 border rounded">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-red-900 text-white rounded hover:bg-red-800">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deletingId && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Admin</h3>
              <p className="text-sm text-gray-700 mb-4">Are you sure you want to delete this admin? This action cannot be undone.</p>
              <div className="flex gap-3 justify-end">
                <button className="px-4 py-2 border rounded" onClick={() => setDeletingId(null)}>Cancel</button>
                <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700" onClick={confirmDelete}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminUsers;
