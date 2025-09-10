import React, { useEffect, useState } from 'react';
import { useProgramContext } from '../../../context/ProgramContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiUpload, FiLayers, FiAlertCircle, FiCheckCircle, FiDownload } from 'react-icons/fi';
import config from '../../../config';
import { motion, AnimatePresence } from 'framer-motion';

const CombinedUpload = () => {
  const { selectedProgramId, programInfo } = useProgramContext();
  const location = useLocation();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(location.search);
  const urlProgramCode = urlParams.get('programCode');
  const programCode = urlProgramCode || programInfo?.code || null;
  const basePrefix = location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';
  const [file, setFile] = useState(null);
  const [defaultCredits, setDefaultCredits] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState('');
  const [headerHint, setHeaderHint] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dropFeedback, setDropFeedback] = useState(null); // 'accepted' | 'rejected' | null
  const [showUploader, setShowUploader] = useState(true);
  const overlayActive = uploading || !!uploadResult;

  // Global drag overlay handlers
  useEffect(() => {
    const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const onDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
    const onDrop = (e) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) {
        const isCsv = f.type === 'text/csv' || f.type?.includes('csv') || f.name?.toLowerCase().endsWith('.csv');
        setDropFeedback(isCsv ? 'accepted' : 'rejected');
        setTimeout(() => setDropFeedback(null), 1200);
        processSelectedFile(f);
      }
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  // --- Combined CSV header validation (normalize + alias support) ---
  const normalize = (s = '') => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, '');
  const mapHeader = (h) => {
    const n = normalize(h);
    // aliases
    if (['slno', 'sl', 'sno', 'serialno'].includes(n)) return 'slno';
    if (['category', 'categoryname', 'catname'].includes(n)) return 'category';
    if (['mincourses', 'mincourses#', 'mincoursesnumber', 'mincourse'].includes(n)) return 'mincourses';
    if (['mincredits', 'mincredits#', 'mincredit', 'mincr', 'mincred'].includes(n)) return 'mincredits';
    if (['coursecode', 'code'].includes(n)) return 'coursecode';
    if (['coursetitle', 'coursename', 'title', 'name'].includes(n)) return 'coursetitle';
    if (['cr', 'credit', 'credits'].includes(n)) return 'cr';
    return n; // fallback normalized
  };

  const requiredCols = ['slno', 'category', 'mincourses', 'mincredits', 'coursecode', 'coursetitle', 'cr'];

  const validateCombinedCsv = (firstLine) => {
    if (!firstLine) return { ok: false, msg: 'CSV appears empty' };
    // Split by comma while keeping simple (template is simple CSV without quoted commas in header)
    const headers = firstLine.split(',').map(h => h.trim());
    const mapped = headers.map(mapHeader);
    const missing = requiredCols.filter(c => !mapped.includes(c));
    if (missing.length) {
      return {
        ok: false,
        msg: `Missing required columns: ${missing.join(', ')}`
      };
    }
    return { ok: true, msg: 'Headers look good' };
  };

  const processSelectedFile = async (selectedFile) => {
    const isCsv = selectedFile && (
      selectedFile.type === 'text/csv' ||
      selectedFile.type?.includes('csv') ||
      selectedFile.name?.toLowerCase().endsWith('.csv')
    );
    if (!isCsv) {
      setError('Please select a valid CSV file');
      setFile(null);
      setHeaderHint('');
      return;
    }
    // Read first line for header validation
    try {
      const text = await selectedFile.text();
      const firstLine = (text.split(/\r?\n/).find(l => l && l.trim().length) || '').trim();
      const res = validateCombinedCsv(firstLine);
      if (!res.ok) {
        setError(res.msg);
        setHeaderHint('');
        setFile(null);
        return;
      }
      setError('');
      setHeaderHint(res.msg);
      setUploadResult(null);
      setFile(selectedFile);
      setShowUploader(true);
    } catch (e) {
      setError('Failed to read CSV file for validation');
      setFile(null);
      setHeaderHint('');
    }
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) await processSelectedFile(selectedFile);
  };

  const handleUpload = async () => {

    
    // Prevent multiple simultaneous uploads
    if (uploading) {
      return;
    }

    if (!file || !programCode) {
      setError('Please select a file and ensure a program is selected');
      return;
    }

    setUploading(true);
    setShowUploader(false);
    setError('');
    setUploadResult(null);
    

    const formData = new FormData();
    formData.append('file', file);
    

    let succeeded = false;
    try {
      const params = new URLSearchParams({ programCode: programCode });
      if (defaultCredits) params.append('defaultCredits', String(defaultCredits));
      const uploadUrl = `${config.backendUrl}/api/combined/upload?${params.toString()}`;
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      const contentType = response.headers.get('content-type') || '';
      if (response.ok) {
        let messages = [];
        if (contentType.includes('application/json')) {
          const data = await response.json();
          messages = Array.isArray(data) ? data : [JSON.stringify(data)];
        } else {
          const txt = await response.text();
          try { messages = JSON.parse(txt); } catch { messages = txt.split(/\n+/).filter(Boolean); }
        }
        // Parse combined summary
        const counts = { categories: { created: 0, updated: 0 }, courses: { created: 0, updated: 0 }, mappings: { created: 0, updated: 0 } };
        messages.forEach(m => {
          const cat = /Categories\s*-\s*created:\s*(\d+),\s*updated:\s*(\d+)/i.exec(m);
          if (cat) { counts.categories.created = Number(cat[1]); counts.categories.updated = Number(cat[2]); }
          const crs = /Courses\s*-\s*created:\s*(\d+),\s*updated:\s*(\d+)/i.exec(m);
          if (crs) { counts.courses.created = Number(crs[1]); counts.courses.updated = Number(crs[2]); }
          const map = /Course-Category mappings\s*-\s*created:\s*(\d+),\s*updated:\s*(\d+)/i.exec(m);
          if (map) { counts.mappings.created = Number(map[1]); counts.mappings.updated = Number(map[2]); }
        });
        setUploadResult({ success: true, message: 'Upload completed', lines: messages, counts });
        succeeded = true;
        setFile(null);
        setDefaultCredits('');
        document.getElementById('file-input').value = '';
      } else {
        if (contentType.includes('application/json')) {
          const data = await response.json();
          const msg = Array.isArray(data) ? data.join('\n') : (data.message || JSON.stringify(data));
          setError(msg || 'Upload failed');
        } else {
          const errorText = await response.text();
          setError(errorText || 'Upload failed');
        }
      }
    } catch (err) {
      setError('Network error occurred during upload');
    } finally {
      setUploading(false);
      // keep uploader hidden on success, restore on error
      if (!succeeded) {
        setShowUploader(true);
      }
    }
  };

  const downloadTemplate = () => {
    const csvContent =
      "Sl No,CATEGORY,MIN. COURSES #,MIN. CREDITS #,COURSE CODE,COURSE TITLE,CR\n" +
      "1,Humanities & Social Sciences (HSS),11,18,22UC1101,INTEGRATED PROFESSIONAL ENGLISH,2\n" +
      "2,,,,22UC1202,ENGLISH PROFICIENCY,2\n" +
      "3,,,,22UC2103,ESSENTIAL SKILLS FOR EMPLOYABILITY,2\n" +
      "4,,,,22UC2204,CORPORATE READINESS SKILLS,2\n" +
      "5,,,,22UC0010,UNIVERSAL HUMAN VALUES & PROFESSIONAL ETHICS,2\n" +
      "13,Basic Sciences (BS),6,23.5,22MT1101,MATHEMATICS FOR COMPUTING,4.5\n" +
      "14,,,,22MT2102,MATHEMATICS FOR ENGINEERS,3\n" +
      "15,,,,22MT2004,MATHEMATICAL PROGRAMMING,4\n" +
      "16,,,,22MT2005,\"PROBABILITY, STATISTICS & QUEUEING THEORY\",4\n" +
      "17,,,,22PH4102,APPLIED PHYSICS,4\n" +
      "18,,,,22PH4101,QUANTUM PHYSICS FOR ENGINEERS,4";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'combined_categories_courses_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="relative max-w-4xl mx-auto md:p-6">
      {/* Big status overlay for uploading/completed */}
      <AnimatePresence>
        {overlayActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="relative w-full max-w-2xl mx-4 rounded-2xl bg-white p-6 shadow-2xl"
            >
              {/* Close to Uploads */}
              <button
                type="button"
                onClick={() => navigate(`${basePrefix}/upload`)}
                className="absolute top-3 right-3 rounded-md px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700"
                aria-label="Back to Uploads"
              >
                Close
              </button>
              {uploading ? (
                <div className="text-center">
                  <div className="mx-auto mb-4 h-12 w-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                  <h2 className="text-xl font-semibold text-gray-900">Uploading...</h2>
                  <p className="text-gray-700 mt-1">Please wait while we process your file.</p>
                </div>
              ) : (
                uploadResult && (
                  <div>
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <FiCheckCircle className="h-10 w-10 text-green-600" />
                      <h2 className="text-xl font-semibold text-gray-900">Upload completed</h2>
                    </div>
                    {uploadResult.counts && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <div className="bg-green-50 border border-green-200 rounded-md p-3">
                          <div className="font-medium text-gray-900">Categories</div>
                          <div className="text-gray-700">Created: {uploadResult.counts.categories.created}</div>
                          <div className="text-gray-700">Updated: {uploadResult.counts.categories.updated}</div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-md p-3">
                          <div className="font-medium text-gray-900">Courses</div>
                          <div className="text-gray-700">Created: {uploadResult.counts.courses.created}</div>
                          <div className="text-gray-700">Updated: {uploadResult.counts.courses.updated}</div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-md p-3">
                          <div className="font-medium text-gray-900">Mappings</div>
                          <div className="text-gray-700">Created: {uploadResult.counts.mappings.created}</div>
                          <div className="text-gray-700">Updated: {uploadResult.counts.mappings.updated}</div>
                        </div>
                      </div>
                    )}
                    {Array.isArray(uploadResult.lines) && uploadResult.lines.length > 0 && (
                      <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1 mt-4 max-h-64 overflow-auto">
                        {uploadResult.lines.map((ln, i) => (
                          <li key={i}>{ln}</li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => { setUploadResult(null); setShowUploader(true); setError(''); setHeaderHint(''); }}
                        className="px-4 py-2 rounded-md text-sm bg-purple-600 text-white hover:bg-purple-700"
                      >
                        Upload another file
                      </button>
                    </div>
                  </div>
                )
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Full-screen drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.98 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.98 }}
              className={`mx-4 w-full max-w-xl rounded-2xl border-2 ${dropFeedback === 'accepted' ? 'border-green-400 bg-green-50' : dropFeedback === 'rejected' ? 'border-red-400 bg-red-50' : 'border-dashed border-white/70 bg-white/80'} p-8 text-center shadow-xl`}
            >
              <FiUpload className={`mx-auto h-10 w-10 ${dropFeedback === 'rejected' ? 'text-red-500' : 'text-purple-600'}`} />
              <div className="mt-3 text-lg font-semibold text-gray-900">Drop CSV anywhere to upload</div>
              <div className="text-sm text-gray-700">{dropFeedback === 'rejected' ? 'Only .csv files are supported' : 'We will validate headers before upload'}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="bg-white rounded-lg shadow-lg">
        <div className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiLayers className="h-6 w-6 text-purple-600" />
            Category and Course Upload
          </h1>
          {programInfo && (
            <p className="text-sm text-gray-600 mt-1">
              Uploading to: <span className="font-medium">{programInfo.name}</span>
            </p>
          )}
        </div>

        <div className="p-6">
          {/* Loader replaces instructions and download button during uploading */}
          <AnimatePresence>
            {!overlayActive && uploading && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mb-6">
                <div className="flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="h-5 w-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                  <div className="text-purple-900 text-sm">Uploading... Please wait while we process your file.</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!uploading && showUploader && (
            <>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-purple-900 mb-2">Upload Instructions</h3>
                <ul className="text-sm text-purple-800 space-y-1">
                  <li>• Upload a CSV file containing both categories and courses information</li>
                  <li>• Required columns: Sl No, CATEGORY, MIN COURSES , MIN CREDITS , COURSE CODE, COURSE TITLE, CR</li>
                  <li>• File size limit: 10MB</li>
                  <li>• Categories and courses will be created/updated for the current program</li>
                  <li>• Duplicate categories will be merged automatically</li>
                </ul>
              </div>

              <div className="mb-6 flex justify-center md:justify-start">
                <button
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  <FiDownload className="h-4 w-4" />
                  Download Template
                </button>
              </div>
            </>
          )}

          <div className="space-y-4">
            {showUploader && !uploading && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Credits (Optional)
                </label>
                <input
                  type="number"
                  value={defaultCredits}
                  onChange={(e) => setDefaultCredits(e.target.value)}
                  placeholder="Enter default credits for courses without credit info"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be used for courses that don't have credit information in the CSV
                </p>
              </div>
            )}

            <AnimatePresence>
            {showUploader && !uploading && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select CSV File
              </label>
              <div className="flex items-center justify-center w-full">
                <label 
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const droppedFiles = e.dataTransfer.files;
                    if (droppedFiles.length > 0) {
                      const droppedFile = droppedFiles[0];
                      const isCsv = droppedFile && (
                        droppedFile.type === 'text/csv' ||
                        droppedFile.type?.includes('csv') ||
                        droppedFile.name?.toLowerCase().endsWith('.csv')
                      );
                      setDropFeedback(isCsv ? 'accepted' : 'rejected');
                      setTimeout(() => setDropFeedback(null), 1200);
                      processSelectedFile(droppedFile);
                    }
                  }}
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FiUpload className="w-8 h-8 mb-4 text-gray-500" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">CSV files only</p>
                  </div>
                  <input
                    id="file-input"
                    type="file"
                    accept="text/csv,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {!programCode && (
                  <p className="text-xs text-amber-600 mt-2">Select a program from the header to enable upload.</p>
                )}
              </div>
            </div>
            </motion.div>
            )}
            </AnimatePresence>

            {showUploader && !uploading && file && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  Selected file: <span className="font-medium">{file.name}</span>
                </p>
                {headerHint && (
                  <p className="text-xs text-green-700 mt-1">{headerHint}</p>
                )}
              </div>
            )}

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2"
                >
                  <FiAlertCircle className="h-4 w-4 text-red-600" />
                  <p className="text-sm text-red-800">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
            {!overlayActive && uploadResult && (
              <div className={`border rounded-lg p-4 ${uploadResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <FiCheckCircle className={`h-4 w-4 ${uploadResult.success ? 'text-green-600' : 'text-red-600'}`} />
                  <p className={`text-sm ${uploadResult.success ? 'text-green-800' : 'text-red-800'}`}>{uploadResult.message}</p>
                </div>
                {Array.isArray(uploadResult.lines) && uploadResult.lines.length > 0 && (
                  <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1">
                    {uploadResult.lines.map((ln, i) => (
                      <li key={i}>{ln}</li>
                    ))}
                  </ul>
                )}
                {uploadResult.counts && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="bg-white/60 border border-green-200 rounded-md p-3">
                      <div className="font-medium text-gray-900">Categories</div>
                      <div className="text-gray-700">Created: {uploadResult.counts.categories.created}</div>
                      <div className="text-gray-700">Updated: {uploadResult.counts.categories.updated}</div>
                    </div>
                    <div className="bg-white/60 border border-green-200 rounded-md p-3">
                      <div className="font-medium text-gray-900">Courses</div>
                      <div className="text-gray-700">Created: {uploadResult.counts.courses.created}</div>
                      <div className="text-gray-700">Updated: {uploadResult.counts.courses.updated}</div>
                    </div>
                    <div className="bg-white/60 border border-green-200 rounded-md p-3">
                      <div className="font-medium text-gray-900">Mappings</div>
                      <div className="text-gray-700">Created: {uploadResult.counts.mappings.created}</div>
                      <div className="text-gray-700">Updated: {uploadResult.counts.mappings.updated}</div>
                    </div>
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setUploadResult(null); setShowUploader(true); setError(''); setHeaderHint(''); }}
                    className="px-3 py-2 rounded-md text-sm bg-white border hover:bg-gray-50"
                  >
                    Upload another file
                  </button>
                </div>
              </div>
            )}
            </AnimatePresence>

            <AnimatePresence>
              {uploading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2"
                >
                  <FiAlertCircle className="h-4 w-4 text-blue-600" />
                  <p className="text-sm text-blue-800">
                    Processing may take a few seconds to minutes. Please wait and do not close this tab.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showUploader && !uploading && (
                <motion.button
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!uploading) {
                      await handleUpload();
                    }
                  }}
                  disabled={uploading || !file}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <FiUpload className="w-4 h-4" />
                  <span>Upload File</span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CombinedUpload;
