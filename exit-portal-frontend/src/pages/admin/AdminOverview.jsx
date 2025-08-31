import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import StatCard from '../../components/admin/StatCard';

const QuickLink = ({ to, label, onClick }) => (
  <button onClick={onClick} className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 shadow-sm">
    {label}
  </button>
);

const AdminOverview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedProgramId, programInfo, setProgramContext } = useProgramContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  
  // Use program context or URL params
  const urlParams = new URLSearchParams(location.search);
  const urlProgramId = urlParams.get('programId');
  const programId = selectedProgramId || urlProgramId;
  const urlProgramCode = urlParams.get('programCode');
  const programCode = programInfo?.code || urlProgramCode || null;

  useEffect(() => {
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) {
      navigate('/login');
      return;
    }
    
    let isCancelled = false;
    
    const load = async () => {
      try {
        setLoading(true);
        // Build API URL with programId
        let apiUrl = `${config.backendUrl}/api/v1/admin/dashboard`;
        
        // For SUPER_ADMIN, use programId from context/URL if available
        // For ADMIN, always use their assigned program
        let effectiveProgramId = null;
        if (user?.userType === 'SUPER_ADMIN' && programId) {
          effectiveProgramId = programId;
        } else if (user?.userType === 'ADMIN' && user?.programId) {
          effectiveProgramId = user.programId;
        }
        
        if (effectiveProgramId) {
          apiUrl += `?programId=${effectiveProgramId}`;
        }
        
        
        const res = await axios.get(apiUrl, { withCredentials: true });
        
        if (isCancelled) return; // Prevent state update if component unmounted or effect cancelled
        
        setData(res.data || {});
        
        // Fetch program details if we have an effective program ID and don't have current program info
        if (effectiveProgramId && (!programInfo || programInfo.programId != effectiveProgramId)) {
          try {
            const programRes = await axios.get(`${config.backendUrl}/api/v1/admin/programs/${effectiveProgramId}`, { withCredentials: true });
            if (!isCancelled) {
              setProgramContext(effectiveProgramId, programRes.data);
            }
          } catch (progErr) {
            console.error('Failed to load program info:', progErr);
          }
        }
      } catch (e) {
        if (!isCancelled) {
          console.error(e);
          setError('Failed to load overview');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };
    
    load();
    
    return () => {
      isCancelled = true;
    };
  }, [user, navigate, programId, setProgramContext]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-900 mx-auto" />
          <p className="mt-4 text-gray-600">Loading overview...</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">{error}</div>
    );
  }

  // Determine base path for navigation
  const basePath = location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';
  const isSuperAdmin = user?.userType === 'SUPER_ADMIN';
  
  return (
    <div className="space-y-8">
      {/* Program Info Section */}
      {programInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-2 text-center md:text-left">Program Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-center md:text-left ">
            <div>
              <span className="font-medium text-blue-800">Code:</span>
              <span className="ml-2 text-blue-700">{programInfo.code}</span>
            </div>
            <div>
              <span className="font-medium text-blue-800">Name:</span>
              <span className="ml-2 text-blue-700">{programInfo.name}</span>
            </div>
          </div>
        </div>
      )}
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {programInfo ? `${programInfo.code} - Overview` : 'Overview'}
        </h2>
        <p className="text-sm text-gray-600">
          {programInfo ? `Program-specific snapshot and navigation` : `${user?.programName ? user.programName + ' - ' : ''}Program snapshot and quick navigation`}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 items-stretch">
        <StatCard title="Students" value={data?.stats?.totalStudents} color="blue" subtitle="Total enrolled" />
        <StatCard title="Completed" value={data?.stats?.completedStudents} color="green" subtitle="Met requirements" />
        <StatCard title="In Progress" value={data?.stats?.inProgressStudents} color="yellow" subtitle="Tracking to complete" />
        {/* <StatCard title="Categories" value={data?.stats?.totalCategories} color="purple" subtitle="Available" /> */}
      </div>

   

      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Upload</h3>
        <div className="-mx-1 overflow-x-auto sm:overflow-visible">
          <div className="px-1 flex gap-2 sm:gap-3 flex-nowrap sm:flex-wrap flex-col md:flex-row">
            <QuickLink label="Category & Course Upload" onClick={() => navigate(`${basePath}/upload/combined${programCode ? `?programCode=${encodeURIComponent(programCode)}` : ''}`)} />
            <QuickLink label="Student Result Upload" onClick={() => navigate(`${basePath}/upload/results${programCode ? `?programCode=${encodeURIComponent(programCode)}` : ''}`)} />
            <QuickLink label="Registration Upload" onClick={() => navigate(`${basePath}/upload/registrations${programCode ? `?programCode=${encodeURIComponent(programCode)}` : ''}`)} />
          </div>
        </div>
      </div>

      {Array.isArray(data?.bottlenecks) && data.bottlenecks.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Top Bottlenecks</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.bottlenecks.map((b, idx) => (
              <div key={idx} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-900">{b.category}</div>
                  <span className="text-xs text-gray-500">#{idx + 1}</span>
                </div>
                <div className="mt-2 text-sm text-gray-700">Met rate: {(b.metRate * 100).toFixed(1)}%</div>
                <div className="text-sm text-gray-700">Avg credit completion: {(b.avgCreditCompletion * 100).toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
         <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick actions</h3>
        <div className="-mx-1 overflow-x-auto sm:overflow-visible">
          <div className="px-1 flex gap-2 sm:gap-3 flex-nowrap sm:flex-wrap flex-col md:flex-row">
            <QuickLink label="Students" onClick={() => navigate(`${basePath}/students${programId ? `?programId=${programId}` : ''}`)} />
            <QuickLink label="Categories" onClick={() => navigate(`${basePath}/categories${programId ? `?programId=${programId}` : ''}`)} />
            <QuickLink label="Courses" onClick={() => navigate(`${basePath}/courses${programId ? `?programId=${programId}` : ''}`)} />
            <QuickLink label="Grades" onClick={() => navigate(`${basePath}/grades${programId ? `?programId=${programId}` : ''}`)} />
            <QuickLink label="Progress" onClick={() => navigate(`${basePath}/progress${programId ? `?programId=${programId}` : ''}`)} />
            {isSuperAdmin && (
              <QuickLink label="Admin Users" onClick={() => navigate(`${basePath}/users`)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
