import React, { useState } from 'react';
import { useProgramContext } from '../../../context/ProgramContext';
import { useLocation } from 'react-router-dom';
import { FiUpload, FiLayers, FiAlertCircle, FiCheckCircle, FiDownload } from 'react-icons/fi';
import config from '../../../config';

const CombinedUpload = () => {
  const { selectedProgramId, programInfo } = useProgramContext();
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const urlProgramCode = urlParams.get('programCode');
  const programCode = urlProgramCode || programInfo?.code || null;
  const [file, setFile] = useState(null);
  const [defaultCredits, setDefaultCredits] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState('');

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

    
    // Prevent multiple simultaneous uploads
    if (uploading) {
      return;
    }

    if (!file || !programCode) {
      setError('Please select a file and ensure a program is selected');
      return;
    }

    setUploading(true);
    setError('');
    setUploadResult(null);
    

    const formData = new FormData();
    formData.append('file', file);
    

    try {
      const params = new URLSearchParams({ programCode: programCode });
      if (defaultCredits) params.append('defaultCredits', String(defaultCredits));
      const uploadUrl = `${config.backendUrl}/api/combined/upload?${params.toString()}`;
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      

      if (response.ok) {
        const result = await response.text();
        setUploadResult({ success: true, message: result });
        setFile(null);
        setDefaultCredits('');
        document.getElementById('file-input').value = '';
      } else {
        const errorText = await response.text();
        setError(errorText || 'Upload failed');
      }
    } catch (err) {
      setError('Network error occurred during upload');
    } finally {
      setUploading(false);
      
    }
  };

  const downloadTemplate = () => {
    const csvContent = "Sl No,CATEGORY,MIN. COURSES #,MIN. CREDITS #,COURSE CODE,COURSE TITLE,CR\n1,Mathematics,2,6,22MT1101,Calculus I,3\n2,Mathematics,2,6,22MT1102,Linear Algebra,3\n3,Computer Science,3,12,22CS1101,Programming Fundamentals,4";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'combined_categories_courses_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
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
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-purple-900 mb-2">Upload Instructions</h3>
            <ul className="text-sm text-purple-800 space-y-1">
              <li>• Upload a CSV file containing both categories and courses information</li>
              <li>• Required columns: Sl No, CATEGORY, MIN. COURSES #, MIN. CREDITS #, COURSE CODE, COURSE TITLE, CR</li>
              <li>• File size limit: 10MB</li>
              <li>• Categories and courses will be created/updated for the current program</li>
              <li>• Duplicate categories will be merged automatically</li>
            </ul>
          </div>

          <div className="mb-6">
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <FiDownload className="h-4 w-4" />
              Download Template
            </button>
          </div>

          <div className="space-y-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select CSV File
              </label>
              <div className="flex items-center justify-center w-full">
                <label 
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                  onDragOver={(e) => {
                    e.preventDefault();
                    console.log('🔄 Drag over event');
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    console.log('🔄 Drag enter event');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    console.log('📁 Drop event triggered:', e);
                    const droppedFiles = e.dataTransfer.files;
                    console.log('📁 Dropped files:', droppedFiles);
                    if (droppedFiles.length > 0) {
                      const droppedFile = droppedFiles[0];
                      console.log('📋 Dropped file details:', {
                        name: droppedFile.name,
                        type: droppedFile.type,
                        size: droppedFile.size
                      });
                      const isCsv = droppedFile && (
                        droppedFile.type === 'text/csv' ||
                        droppedFile.type?.includes('csv') ||
                        droppedFile.name?.toLowerCase().endsWith('.csv')
                      );
                      if (isCsv) {
                        console.log('✅ Valid CSV file dropped');
                        setFile(droppedFile);
                        setError('');
                        setUploadResult(null);
                      } else {
                        console.log('❌ Invalid file type dropped:', droppedFile.type);
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

            {file && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  Selected file: <span className="font-medium">{file.name}</span>
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <FiAlertCircle className="h-4 w-4 text-red-600" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {uploadResult && (
              <div className={`border rounded-lg p-3 flex items-center gap-2 ${
                uploadResult.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <FiCheckCircle className={`h-4 w-4 ${
                  uploadResult.success ? 'text-green-600' : 'text-red-600'
                }`} />
                <p className={`text-sm ${
                  uploadResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {uploadResult.message}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ Upload button click event:', e);
                console.log('🔍 Button state check:', {
                  file: !!file,
                  uploading: uploading,
                  programCode: !!programCode
                });

                if (!uploading) {
                  console.log('⚡ Triggering upload...');
                  await handleUpload();
                } else {
                  console.log('⏸️ Upload blocked (already uploading)');
                }
              }}
              disabled={uploading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <FiUpload className="w-4 h-4" />
                  <span>Upload File</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CombinedUpload;
