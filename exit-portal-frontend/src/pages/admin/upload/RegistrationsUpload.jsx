import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProgramContext } from '../../../context/ProgramContext';
import { FiUpload, FiUsers, FiAlertCircle, FiCheckCircle, FiDownload } from 'react-icons/fi';
import config from '../../../config';
import { motion, AnimatePresence } from 'framer-motion';

const RegistrationsUpload = () => {
  const { selectedProgramId, programInfo } = useProgramContext();
  const location = useLocation();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(location.search);
  const urlProgramCode = urlParams.get('programCode');
  const programCode = urlProgramCode || programInfo?.code || null;
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState('');
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
        if (isCsv) {
          setFile(f);
          setError('');
          setUploadResult(null);
        }
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

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    const isCsv = selectedFile && (
      selectedFile.type === 'text/csv' ||
      selectedFile.type?.includes('csv') ||
      selectedFile.name?.toLowerCase().endsWith('.csv')
    );
    if (isCsv) {
      setFile(selectedFile);
      setError('');
      setUploadResult(null);
    } else {
      setError('Please select a valid CSV file');
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setShowUploader(false);
    setError('');
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${config.backendUrl}/api/grades/registrations-upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const contentType = response.headers.get('content-type') || '';
      let succeeded = false;
      if (response.ok) {
        let messages = [];
        if (contentType.includes('application/json')) {
          const data = await response.json();
          messages = Array.isArray(data) ? data : [JSON.stringify(data)];
        } else {
          const txt = await response.text();
          try { messages = JSON.parse(txt); } catch { messages = txt.split(/\n+/).filter(Boolean); }
        }
        // Parse warnings and stats from registrations response
        const warnings = [];
        const stats = { gradesUpdated: 0, missingInserted: 0 };
        messages.forEach(m => {
          const s = String(m);
          if (/^Skipped\s+unknown\s+course\s+codes/i.test(s)) warnings.push(s);
          const upd = /Grades\s+updated:\s*(\d+)/i.exec(s);
          if (upd) stats.gradesUpdated = Number(upd[1]);
          const miss = /Missing\s+registrations\s+inserted:\s*(\d+)/i.exec(s);
          if (miss) stats.missingInserted = Number(miss[1]);
        });
        setUploadResult({ success: true, message: 'Upload completed', lines: messages, warnings, stats });
        succeeded = true;
        setFile(null);
        const input = document.getElementById('file-input');
        if (input) input.value = '';
      } else {
        if (contentType.includes('application/json')) {
          const data = await response.json();
          const message = Array.isArray(data) ? data.join('\n') : (data.message || JSON.stringify(data));
          setError(message || 'Upload failed');
        } else {
          const errorText = await response.text();
          setError(errorText || 'Upload failed');
        }
      }
    } catch (err) {
      setError('Network error occurred during upload');
    } finally {
      setUploading(false);
      if (!succeeded) setShowUploader(true);
    }
  };

  const downloadTemplate = () => {
    // ERP SRC sample (first 3 rows) with exact headers from RegistrationDates.csv
    const csvContent =
      "ProfileID,University ID,Name,CourseCode,LTPS,CourseDesc,Bucket Group,Course Nature,AcademicYear,Semester,Study Year,Section,RegisterDate,course ref id,Offered To,Offered By,Course Catalogue\n" +
      "60147,2200080268,Miriyala Bala Kiran,22AD1202,L,OBJECT ORIENTED PROGRAMMING SYSTEM (PYTHON),mandatory,Regular,2022-2023,Even Sem,1,S-4-MA,12/26/22,42902,AI&DS,DBES-1,ESC\n" +
      "60147,2200080268,Miriyala Bala Kiran,22AD1202,P,OBJECT ORIENTED PROGRAMMING SYSTEM (PYTHON),mandatory,Regular,2022-2023,Even Sem,1,S-4-MA,12/26/22,42902,AI&DS,DBES-1,ESC\n" +
      "60147,2200080268,Miriyala Bala Kiran,22AD1202,S,OBJECT ORIENTED PROGRAMMING SYSTEM (PYTHON),mandatory,Regular,2022-2023,Even Sem,1,S-4-MA,12/26/22,42902,AI&DS,DBES-1,ESC";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'RegistrationDates_sample.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="relative max-w-4xl mx-auto md:p-6 ">
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
                onClick={() => navigate('/admin/upload')}
                className="absolute top-3 right-3 rounded-md px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700"
                aria-label="Back to Uploads"
              >
                Close
              </button>
              {uploading ? (
                <div className="text-center">
                  <div className="mx-auto mb-4 h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
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
                    {uploadResult.stats && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="bg-green-50 border border-green-200 rounded-md p-3">
                          <div className="font-medium text-gray-900">Grades updated</div>
                          <div className="text-gray-700">{uploadResult.stats.gradesUpdated}</div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-md p-3">
                          <div className="font-medium text-gray-900">Missing registrations inserted</div>
                          <div className="text-gray-700">{uploadResult.stats.missingInserted}</div>
                        </div>
                      </div>
                    )}
                    {uploadResult.warnings && uploadResult.warnings.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 my-3">
                        <div className="text-sm font-medium text-yellow-900 mb-1">Warnings</div>
                        <ul className="list-disc pl-5 text-sm text-yellow-900 space-y-1 max-h-40 overflow-auto">
                          {uploadResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(uploadResult.lines) && uploadResult.lines.length > 0 && (
                      <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1 mt-3 max-h-64 overflow-auto">
                        {uploadResult.lines.map((ln, i) => (
                          <li key={i}>{ln}</li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => { setUploadResult(null); setShowUploader(true); setError(''); }}
                        className="px-4 py-2 rounded-md text-sm bg-indigo-600 text-white hover:bg-indigo-700"
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
              <FiUpload className={`mx-auto h-10 w-10 ${dropFeedback === 'rejected' ? 'text-red-500' : 'text-indigo-600'}`} />
              <div className="mt-3 text-lg font-semibold text-gray-900">Drop CSV anywhere to upload</div>
              <div className="text-sm text-gray-700">{dropFeedback === 'rejected' ? 'Only .csv files are supported' : 'ERP SRC headers expected as in sample'}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="bg-white rounded-lg shadow-lg">
        <div className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiUsers className="h-6 w-6 text-indigo-600 " />
            Student Registration Courses (SRC) Upload
          </h1>
          {programInfo && (
            <p className="text-sm text-gray-600 mt-1">
              Uploading to: <span className="font-medium">{programInfo.name}</span>
            </p>
          )}
        </div>

        <div className="p-6">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-indigo-900 mb-2">Upload Instructions</h3>
            
            <ul className="text-sm text-indigo-800 space-y-1">
              <li>• Upload SRC (Student Registration Courses) data exported from the ERP</li>
              <li>• Expected headers (ERP export): Download the sample file to see the expected headers</li>
              <li className='hidden md:block'>• Minimum required for processing: University ID, CourseCode, AcademicYear, Semester.</li>
              <li>• File size limit: 10MB</li>
              <li>• Course codes must exist in the system</li>
              <li className='hidden md:block'>• AcademicYear examples: 2022-2023, 2023-2024</li>
              <li className='hidden md:block'>• Semester examples: Odd Sem, Even Sem, Summer</li>
            </ul>
          </div>

          <div className="mb-6 flex justify-center md:justify-start">
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <FiDownload className="h-4 w-4" />
              Download ERP SRC Sample
            </button>
          </div>

          <div className="space-y-4">
            <AnimatePresence>
            {showUploader && !uploading && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select CSV File
                </label>
                <div className="flex items-center justify-center w-full">
                  <label 
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const droppedFiles = e.dataTransfer.files;
                      if (droppedFiles.length > 0) {
                        const droppedFile = droppedFiles[0];
                        const isCsv = droppedFile && (
                          droppedFile.type === 'text/csv' ||
                          droppedFile.type?.includes('csv') ||
                          droppedFile.name?.toLowerCase().endsWith('.csv')
                        );
                        if (isCsv) {
                          setFile(droppedFile);
                          setError('');
                          setUploadResult(null);
                        } else {
                          setError('Please select a valid CSV file');
                          setFile(null);
                        }
                      }
                    }}
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FiUpload className="w-8 h-8 mb-4 text-gray-500" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">CSV files only (ERP SRC export)</p>
                    </div>
                    <input
                      id="file-input"
                      type="file"
                      accept="text/csv,.csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </motion.div>
            )}
            </AnimatePresence>

            {file && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  Selected file: <span className="font-medium">{file.name}</span>
                </p>
              </div>
            )}

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <FiAlertCircle className="h-4 w-4 text-red-600" />
                  <p className="text-sm text-red-800">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
            {uploadResult && (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className={`border rounded-lg p-4 ${uploadResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <FiCheckCircle className={`h-4 w-4 ${uploadResult.success ? 'text-green-600' : 'text-red-600'}`} />
                  <p className={`text-sm ${uploadResult.success ? 'text-green-800' : 'text-red-800'}`}>{uploadResult.message}</p>
                </div>
                {uploadResult.warnings && uploadResult.warnings.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-3">
                    <div className="text-sm font-medium text-yellow-900 mb-1">Warnings</div>
                    <ul className="list-disc pl-5 text-sm text-yellow-900 space-y-1">
                      {uploadResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
                {uploadResult.stats && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="bg-white/60 border border-green-200 rounded-md p-3">
                      <div className="font-medium text-gray-900">Grades updated</div>
                      <div className="text-gray-700">{uploadResult.stats.gradesUpdated}</div>
                    </div>
                    <div className="bg-white/60 border border-green-200 rounded-md p-3">
                      <div className="font-medium text-gray-900">Missing registrations inserted</div>
                      <div className="text-gray-700">{uploadResult.stats.missingInserted}</div>
                    </div>
                  </div>
                )}
                {Array.isArray(uploadResult.lines) && uploadResult.lines.length > 0 && (
                  <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1 mt-3">
                    {uploadResult.lines.map((ln, i) => (
                      <li key={i}>{ln}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setUploadResult(null); setShowUploader(true); setError(''); }}
                    className="px-3 py-2 rounded-md text-sm bg-white border hover:bg-gray-50"
                  >
                    Upload another file
                  </button>
                </div>
              </motion.div>
            )}
            </AnimatePresence>

            <AnimatePresence>
              {!overlayActive && uploading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
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
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  onClick={handleUpload}
                  disabled={uploading || !file}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <FiUpload className="h-4 w-4" />
                  Upload Registrations
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationsUpload;
