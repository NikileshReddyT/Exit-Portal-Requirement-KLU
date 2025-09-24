import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { FiAlertTriangle, FiTrash2 } from 'react-icons/fi';
import { useProgramContext } from '../../context/ProgramContext';
import { useAuth } from '../../context/AuthContext';
import config from '../../config';
import SEO from '../../components/SEO';

export default function AdminDangerZone() {
  const { programInfo } = useProgramContext();
  const { user } = useAuth();

  const [confirmText, setConfirmText] = useState('');
  const [ack1, setAck1] = useState(false);
  const [ack2, setAck2] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const isSuperAdmin = user?.userType === 'SUPER_ADMIN';

  // For SUPER_ADMIN allow overriding code/name; for ADMIN, show readonly from programInfo
  const [targetCode, setTargetCode] = useState(programInfo?.code || '');
  const [targetName, setTargetName] = useState(programInfo?.name || '');

  React.useEffect(() => {
    if (programInfo?.code) setTargetCode(programInfo.code);
    if (programInfo?.name) setTargetName(programInfo.name);
  }, [programInfo]);

  const mustType = useMemo(() => {
    // Require exact program code to be typed for confirmation when available, else word DELETE
    return (targetCode && targetCode.trim().length > 0) ? targetCode.trim() : 'DELETE';
  }, [targetCode]);

  const canSubmit = ack1 && ack2 && confirmText.trim() === mustType && !submitting;

  const handleDelete = async () => {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      // Build body: Super Admin can provide code or name; Admin body is ignored (server uses own programId)
      const body = {};
      if (isSuperAdmin) {
        if (targetCode) body.programCode = targetCode;
        if (!targetCode && targetName) body.programName = targetName;
      }
      const res = await axios.delete(`${config.backendUrl}/api/v1/admin/maintenance/program`, { data: body, withCredentials: true });
      setResult(res.data?.message || 'Program deleted successfully.');
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Deletion failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-100vw">
      <SEO title="Danger Zone - KL University Exit Portal" robots="noindex, nofollow" />
      <div >
        <div className="p-6 border border-red-200 rounded-xl bg-red-50">
          <div className="flex items-start gap-3">
            <div className="text-red-700 mt-1"><FiAlertTriangle size={24} /></div>
            <div>
              <h1 className="text-2xl font-bold text-red-800">Danger Zone</h1>
              <p className="text-red-900/80 mt-1">
                This action permanently deletes all data for the selected program. This cannot be undone.
              </p>
            </div>
          </div>
          <ul className="list-disc ml-6 mt-4 text-red-900/90 space-y-1">
            <li><strong>Students</strong> in this program</li>
            <li><strong>Student grades</strong> and progress records</li>
            <li><strong>Program course-category mappings</strong> and category requirements</li>
            <li><strong>Categories</strong> for this program</li>
            <li>Any <strong>orphan courses</strong> not mapped to any program</li>
          </ul>
        </div>
      </div>

      <div className="mt-6 p-6 border rounded-lg">
        <h2 className="text-lg font-semibold">Target Program</h2>
        {isSuperAdmin ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Program Code</label>
              <input value={targetCode} onChange={(e)=>setTargetCode(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="e.g., BT-CS" />
              <p className="text-xs text-gray-500 mt-1">Preferred. If empty, the name will be used.</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Program Name</label>
              <input value={targetName} onChange={(e)=>setTargetName(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="e.g., B Tech - CSE" />
            </div>
          </div>
        ) : (
          <div className="mt-3 text-gray-800">
            <div className="flex gap-6">
              <div>
                <div className="text-sm text-gray-500">Program Code</div>
                <div className="font-medium">{programInfo?.code || '—'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Program Name</div>
                <div className="font-medium">{programInfo?.name || '—'}</div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">As an Admin, you can only delete your own program.</p>
          </div>
        )}
      </div>

      <div className="mt-6 p-6 border rounded-lg">
        <h2 className="text-lg font-semibold">Confirm Deletion</h2>
        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={ack1} onChange={e=>setAck1(e.target.checked)} />
            <span className="text-sm text-gray-700">I understand this action will permanently delete all data for this program and cannot be undone.</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={ack2} onChange={e=>setAck2(e.target.checked)} />
            <span className="text-sm text-gray-700">I have verified the target program details and confirm I want to proceed.</span>
          </label>
          <div className="mt-2">
            <label className="block text-sm text-gray-600 mb-1">Type <span className="font-mono bg-gray-100 px-1 rounded">{mustType}</span> to confirm</label>
            <input value={confirmText} onChange={e=>setConfirmText(e.target.value)} className="md:w-[50%] w-full border rounded px-3 py-2" />
          </div>
        </div>
        {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded">{error}</div>}
        {result && <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded">{result}</div>}
        <button
          className={`mt-6 sm:w-auto w-full inline-flex items-center gap-2 px-5 py-3 rounded bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed`}
          disabled={!canSubmit}
          onClick={handleDelete}
        >
          <FiTrash2 /> {submitting ? 'Deleting…' : 'Delete Program Data'}
        </button>
      </div>
    </div>
  );
}
