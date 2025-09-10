import React, { useEffect, useState } from 'react';
import { useProgramContext } from '../../../context/ProgramContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiUpload, FiBarChart2, FiAlertCircle, FiCheckCircle, FiDownload } from 'react-icons/fi';
import config from '../../../config';
import { motion, AnimatePresence } from 'framer-motion';

const ResultsUpload = () => {
  const { selectedProgramId, programInfo } = useProgramContext();
  const location = useLocation();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(location.search);
  const urlProgramCode = urlParams.get('programCode');
  const programCode = urlProgramCode || programInfo?.code || null;
  const [file, setFile] = useState(null);
  const [defaultCredits, setDefaultCredits] = useState('');
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
          setShowUploader(true);
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
      setShowUploader(true);
    } else {
      setError('Please select a valid CSV file');
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !programCode) {
      setError('Please select a file and ensure a program is selected');
      return;
    }

    setUploading(true);
    setShowUploader(false);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const params = new URLSearchParams({ programCode: programCode });
      if (defaultCredits) params.append('defaultCredits', String(defaultCredits));
      const uploadUrl = `${config.backendUrl}/api/grades/results-upload?${params.toString()}`;

      const response = await fetch(uploadUrl, {
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
        // Extract stats and warnings
        const stats = { created: 0, updated: 0 };
        const warnings = [];
        messages.forEach(m => {
          const mStr = String(m);
          const re = /Results CSV processed\.[^\d]*(Created|created):\s*(\d+)\s*,\s*(Updated|updated):\s*(\d+)/;
          const match = re.exec(mStr);
          if (match) {
            stats.created = Number(match[2]);
            stats.updated = Number(match[4]);
          }
          if (/^Skipped/i.test(mStr)) warnings.push(mStr);
        });
        setUploadResult({ success: true, message: 'Upload completed', lines: messages, stats, warnings });
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
      if (!succeeded) setShowUploader(true);
    }
  };

  const downloadTemplate = () => {
    const lines = [
      "University Id,Student Name,Academic Year,Semester,Attempt CREDITS,OBTAINED CREDITS,22UC1101,22MT1101,22SC1101,22ME1103,22EC1101,22UC1202,22SC1202,22SC1209,22MT2102,22EC1202,22AD1202,22UC1203,22TS1004,22IE2040,OEGN0009,22MT0001,22CI2001,22CS2205R,22CS2104R,22AD2102R,22AD2001,OEGN0001,22AD2102A,22SDCS01A,22MT2004,22UC2103,22UC0021,21UC0013,22MT2005,22EC2210R,22SDAD01A,22UC3108,22AD2203A,22CS2223,22SP2104,22UC0022,21UC0014,22UCCOD1,22AD3104A,22CS2231F,22AD2001A,22SDCI01A,22AD2102P,22SDAD01R,22EC2210P,22AD2203R,22CS2104P,22SP2103,22CS2205A,22EC2210A,22CS2104A,22AD2227,22AD2001R,22SP2116,22SP2105,22SP2114,22EC2223F,22SDDT02A,22CS2221,22SDCI01R,22SP2102,22SP2110,22CS2237,22BT2228,22CS2221F,22AD2001P,22EC2223,22SDCS01R,22AD3104R,22CS2236,22SP2108,22SP2101,22CS2234,22AD2203P,22SP2113,22UC0012,22SDDT01R,22CS2231,22CS2233,22IN2221,22CI2221,22LE1001,22LE1002,22LE1004,OEGN0002,22AD3105A,22SDAD05P,22UC0023,22CEC3101A,22CEC3204,22UC2204,21UC0015,22CCT2BZ,22UC3209,22PH4101,22SDCS04R,22CEC3305A,22UC0024,22AD3206R,22AD3207A,22IE3043,CRTCODL2V1,CRTVQRL2V1,22SDAD05R,22GDU3101R,22GDU3202,22CVQ3FP,22SDCS06A,22GDU3303R,CRTCODL2V5,CRTVQRL2V5,22AD3105R,22SMD3202,22SMD3101A,22CVQ5SM,22SDCI05R,22SMD3303A,22AD3206A,22PH4102,CRTCODL2V7,CRTVQRL2V7,22AD3105P,22AD2223F,22SMD3101R,22CVQ2CH,22SDCI05A,22SMD3303R,CRTCODL2V4,CRTVQRL2V4,22CSB3203,22CSB3101A,22SDCS05A,22CSB3304A,22AD3207P,CRTCODL2V3,CRTVQRL2V3,22SDAD05A,22SDCS05R,22SMD3101P,21CC3002,22AD3206P,22SDCS04A,22CPD3101A,22CPD3203,22CCT1CC,22SDCI04A,22CPD3304A,CRTCODL2V2,CRTVQRL2V2,22GDU3101P,22GDU3303P,22CEC3101P,22CEC3305P,22CS2243F,22CSB3304R,22SDM3101P,22SDM3202,22SDAD06A,22SDM3304A,22CS2230F,22SDM3101A,22CVQ4GK,CRTCODL2V6,CRTVQRL2V6,22GDU3303A,22AD3104P,22ASS3102A,22ASS3205,22SDEE06A,22ASS3309A,22CEC3101R,22CC3061,22CS2247F,22CSB3101R,22DLA3101A,22DLA3203,22SDAD08A,22DLA3304A,22CSB3202,22CEC3305R,22CSB3304P,22GDU3101A,22SDCS06R,22CS2240F,22CSB3101P,22CS2233F,22CEC3203,22CS2237F,22CS2236F,22EC2231F,22CS2224F,",
      "2200080001,VIDYADHARANI VENI  ALEKYA,,,152,152,A+     |   2    |   1-mandatory,O     |   4.5    |   1-mandatory,O     |   5.5    |   1-mandatory,O     |   2    |   1-mandatory,O     |   4    |   1-mandatory,A+     |   2    |   1-mandatory,O     |   5    |   1-mandatory,O     |   2    |   1-mandatory,O     |   3    |   1-mandatory,A+     |   2    |   1-mandatory,O     |   5    |   1-mandatory,A+     |   2    |   1-mandatory,P     |   0    |   1-mandatory,P     |   0    |   1-mandatory,,,A+     |   3    |   1-mandatory,O     |   4    |   1-mandatory,A+     |   3    |   1-mandatory,,,,A+     |   5    |   1-mandatory,O     |   4    |   1-mandatory,A+     |   4    |   1-mandatory,A     |   2    |   1-mandatory,O     |   1    |   1-mandatory,,A+     |   4    |   1-mandatory,,O     |   4    |   1-mandatory,A+     |   1    |   1-mandatory,O     |   6    |   1-mandatory,,,O     |   1    |   1-mandatory,P     |   0    |   1-mandatory,P     |   0    |   1-mandatory,O     |   5    |   1-mandatory,A+     |   3    |   16-FC,A+     |   5    |   1-mandatory,,,,,,,,,A+     |   6    |   1-mandatory,,,,,P     |   0    |   1-mandatory,,,,,,,,,O     |   3    |   16-FC,,,,,,,,,,,,,,,,,,,,,,,,O     |   1    |   1-mandatory,,,B     |   2    |   1-mandatory,P     |   0    |   1-mandatory,,O     |   1    |   47-HAS-CORE,O     |   4    |   49-BSC,,,O     |   1    |   1-mandatory,,A+     |   6    |   1-mandatory,O     |   2    |   1-mandatory,,,,,,,,,,,O     |   4    |   1-mandatory,,,,,,A+     |   5    |   1-mandatory,,,,,,,P     |   0    |   1-mandatory,,,P     |   0    |   50-CRT,P     |   0    |   50-CRT,,,,,,,,O     |   4    |   1-mandatory,,,,,,,,,,,,,,,,,,,O     |   6    |   2-PE1,O     |   3    |   3-PE2,O     |   4    |   43-SDC,O     |   6    |   4-PE3,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,1-mandatory -( 122 credits) || 11-OE1 -( 0 credits) || 16-FC -( 6 credits) || 17-SpecialCase -( 0 credits) || 27-ADDITIONAL -( 0 credits) || 12-OE2 -( 0 credits) || 2-PE1 -( 6 credits) || 3-PE2 -( 3 credits) || 47-HAS-CORE -( 1 credits) || 49-BSC -( 4 credits) || 43-SDC -( 4 credits) || 4-PE3 -( 6 credits) || 61-VAC-CERT -( 0 credits) || 33-VALUE ADDED -( 0 credits) || 50-CRT -( 0 credits) || 84-PE-1 -( 0 credits)",
      "2200080002,CHORAGUDI DEVESWARA SATYANARAYANA,,,150,150,A     |   2    |   1-mandatory,O     |   4.5    |   1-mandatory,O     |   5.5    |   1-mandatory,O     |   2    |   1-mandatory,O     |   4    |   1-mandatory,A     |   2    |   1-mandatory,A+     |   5    |   1-mandatory,O     |   2    |   1-mandatory,O     |   3    |   1-mandatory,O     |   2    |   1-mandatory,O     |   5    |   1-mandatory,O     |   2    |   1-mandatory,P     |   0    |   1-mandatory,P     |   0    |   1-mandatory,,,A+     |   3    |   1-mandatory,A+     |   4    |   1-mandatory,,,,,,,O     |   4    |   1-mandatory,A     |   2    |   1-mandatory,O     |   1    |   1-mandatory,P     |   0    |   1-mandatory,O     |   4    |   1-mandatory,,,A+     |   1    |   1-mandatory,,,,O     |   1    |   1-mandatory,P     |   0    |   1-mandatory,P     |   0    |   1-mandatory,O     |   5    |   1-mandatory,,A+     |   5    |   1-mandatory,O     |   4    |   1-mandatory,O     |   5    |   1-mandatory,O     |   2    |   1-mandatory,O     |   6    |   1-mandatory,O     |   4    |   1-mandatory,O     |   5    |   1-mandatory,P     |   0    |   1-mandatory,,,,,,,,,O     |   3    |   16-FC,,,,,,,,,,,,,,,,,,,,,A+     |   3    |   16-FC,,,,,,,,A+     |   6    |   1-mandatory,O     |   4    |   1-mandatory,O     |   1    |   1-mandatory,,,B     |   2    |   1-mandatory,P     |   0    |   1-mandatory,P     |   0    |   1-mandatory,A     |   1    |   47-HAS-CORE,O     |   4    |   49-BSC,,,O     |   1    |   1-mandatory,O     |   3    |   1-mandatory,A+     |   6    |   1-mandatory,O     |   2    |   1-mandatory,P     |   0    |   50-CRT,P     |   0    |   50-CRT,,,A+     |   3    |   3-PE2,,O     |   4    |   43-SDC,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,O     |   6    |   2-PE1,O     |   6    |   4-PE3,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,1-mandatory -( 120 credits) || 11-OE1 -( 0 credits) || 16-FC -( 6 credits) || 17-SpecialCase -( 0 credits) || 27-ADDITIONAL -( 0 credits) || 12-OE2 -( 0 credits) || 2-PE1 -( 6 credits) || 3-PE2 -( 3 credits) || 47-HAS-CORE -( 1 credits) || 49-BSC -( 4 credits) || 43-SDC -( 4 credits) || 4-PE3 -( 6 credits) || 61-VAC-CERT -( 0 credits) || 33-VALUE ADDED -( 0 credits) || 50-CRT -( 0 credits) || 84-PE-1 -( 0 credits)"
    ];
    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'results_template.csv';
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
                onClick={() => navigate('/admin/upload')}
                className="absolute top-3 right-3 rounded-md px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700"
                aria-label="Back to Uploads"
              >
                Close
              </button>
              {uploading ? (
                <div className="text-center">
                  <div className="mx-auto mb-4 h-12 w-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
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
                          <div className="font-medium text-gray-900">Created</div>
                          <div className="text-gray-700">{uploadResult.stats.created}</div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-md p-3">
                          <div className="font-medium text-gray-900">Updated</div>
                          <div className="text-gray-700">{uploadResult.stats.updated}</div>
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
                        className="px-4 py-2 rounded-md text-sm bg-orange-600 text-white hover:bg-orange-700"
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
              <FiUpload className={`mx-auto h-10 w-10 ${dropFeedback === 'rejected' ? 'text-red-500' : 'text-orange-600'}`} />
              <div className="mt-3 text-lg font-semibold text-gray-900">Drop CSV anywhere to upload</div>
              <div className="text-sm text-gray-700">{dropFeedback === 'rejected' ? 'Only .csv files are supported' : 'Template headers required for best results'}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="bg-white rounded-lg shadow-lg">
        <div className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiBarChart2 className="h-6 w-6 text-orange-600" />
            Student Result Upload
          </h1>
          {programInfo && (
            <p className="text-sm text-gray-600 mt-1">
              Uploading to: <span className="font-medium">{programInfo.name}</span>
            </p>
          )}
        </div>

        <div className="p-6">
          {/* Loader during uploading */}
          <AnimatePresence>
            {!overlayActive && uploading && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mb-6">
                <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="h-5 w-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                  <div className="text-orange-900 text-sm">Uploading... Please wait while we process your file.</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!uploading && showUploader && (
            <>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-orange-900 mb-2">Upload Instructions</h3>
                <ul className="text-sm text-orange-800 space-y-1">
                  <li>• Upload a CSV file containing student results and grades from ERP</li>
                  <li>• Required columns: Match with the template</li>
                  {/* <li>• Course columns should follow format: Grade|Credits|Type (e.g., A+|4|1-mandatory)</li> */}
                  <li>• File size limit: 10MB </li>
                  <li>• Results will be associated with the current program</li>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be used for courses that don't have credit information in the CSV
                </p>
              </div>
            )}

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
                    <p className="text-xs text-gray-500">CSV files only (up to 10MB)</p>
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
                  <span className="text-gray-600 ml-2">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
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
            {!overlayActive && uploadResult && (
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
                      <div className="font-medium text-gray-900">Created</div>
                      <div className="text-gray-700">{uploadResult.stats.created}</div>
                    </div>
                    <div className="bg-white/60 border border-green-200 rounded-md p-3">
                      <div className="font-medium text-gray-900">Updated</div>
                      <div className="text-gray-700">{uploadResult.stats.updated}</div>
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

            {/* Removed duplicate uploading notice; loader above replaces this */}

            <AnimatePresence>
              {showUploader && !uploading && (
                <motion.button
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  onClick={handleUpload}
                  disabled={uploading || !file}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <FiUpload className="h-4 w-4" />
                  Upload Results
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsUpload;
