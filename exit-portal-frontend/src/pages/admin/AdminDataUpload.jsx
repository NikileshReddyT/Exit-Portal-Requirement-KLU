import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiChevronRight, FiFilePlus, FiLayers, FiUploadCloud, FiInfo, FiCheckCircle } from 'react-icons/fi';

// Card rendered as a div to avoid global <button> styles
const Card = ({ title, desc, icon, onClick, accent = '' }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(); }}
    className={`w-full text-left border rounded-xl p-5 hover:shadow-md transition bg-white cursor-pointer ${accent}`}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-red-50 border border-red-100">
          {icon}
        </div>
        <div>
          <div className="font-semibold text-gray-900">{title}</div>
          <div className="text-sm text-gray-600 mt-1">{desc}</div>
        </div>
      </div>
      <FiChevronRight className="mt-1 text-gray-400" />
    </div>
  </div>
);

const AdminDataUpload = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="bg-white border border-red-100 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-red-50 border border-red-100 text-red-700">
            <FiInfo />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-gray-900">Data Upload</h2>
            <p className="text-sm text-gray-700">
              Use the steps below to load or refresh program data. Follow the recommended order to avoid
              missing relationships and validation errors.
            </p>
          </div>
        </div>
      </div>

      {/* Flow / Stepper */}
      <div className="bg-white border border-red-100 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommended upload flow</h3>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Step 1 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-red-600 text-white text-sm font-bold">1</div>
            <div>
              <div className="font-medium text-gray-900">Categories & Courses</div>
              <div className="text-xs text-gray-600">Create or update categories and courses first</div>
            </div>
          </div>
          <div className="hidden md:block flex-1 h-[1px] bg-red-200" />
          {/* Step 2 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-red-600 text-white text-sm font-bold">2</div>
            <div>
              <div className="font-medium text-gray-900">Results</div>
              <div className="text-xs text-gray-600">Upload student results to populate outcomes</div>
            </div>
          </div>
          <div className="hidden md:block flex-1 h-[1px] bg-red-200" />
          {/* Step 3 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-red-600 text-white text-sm font-bold">3</div>
            <div>
              <div className="font-medium text-gray-900">Registrations</div>
              <div className="text-xs text-gray-600">Load student-course registrations for each term</div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card
          title="Category & Course Upload"
          desc="Single CSV to define categories and courses. Run this first to establish structure."
          icon={<FiLayers className="text-red-700" />}
          accent="border-red-200 hover:border-red-300"
          onClick={() => navigate(`${basePath}/upload/combined`)}
        />
        <Card
          title="Student Results Upload"
          desc="CSV of results per student and course. Supports default credits and validation summaries."
          icon={<FiUploadCloud className="text-red-700" />}
          accent="border-red-200 hover:border-red-300"
          onClick={() => navigate(`${basePath}/upload/results`)}
        />
        <Card
          title="Registrations Upload"
          desc="CSV listing which students registered for which courses per term and year."
          icon={<FiFilePlus className="text-red-700" />}
          accent="border-red-200 hover:border-red-300"
          onClick={() => navigate(`${basePath}/upload/registrations`)}
        />
      </div>

      {/* Guidance */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Before you start</h3>
          <ul className="space-y-2 text-sm text-gray-700 list-disc pl-5">
            <li>Prepare CSV files per step. The upload pages include file requirements and a template reference.</li>
            <li>If you manage multiple programs, ensure the correct program is selected before uploading.</li>
            <li>Large files are supported. You’ll see progress and line-by-line validation feedback for errors.</li>
            <li>Re-running an upload is safe; existing rows are updated where applicable.</li>
          </ul>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">What each upload does</h3>
          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <div className="font-medium text-gray-900 mb-1">Categories & Courses</div>
              <p>Creates/updates categories and their courses. This must precede Results and Registrations so those uploads can resolve course references.</p>
            </div>
            <div>
              <div className="font-medium text-gray-900 mb-1">Results</div>
              <p>Inserts student outcomes (grade, promotion). These power completion charts and insights across the admin dashboard.</p>
            </div>
            <div>
              <div className="font-medium text-gray-900 mb-1">Registrations</div>
              <p>Records which students registered for which courses by term and year—useful for cohort analysis and auditing.</p>
            </div>
            <div className="flex items-center gap-2 text-green-700 mt-2">
              <FiCheckCircle />
              <span>After a successful upload, revisit Overview/Insights to see metrics refresh automatically.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDataUpload;
