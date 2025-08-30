import React, { useState } from 'react';
import { useProgramContext } from '../../../context/ProgramContext';
import { useLocation } from 'react-router-dom';
import { FiUpload, FiBarChart2, FiAlertCircle, FiCheckCircle, FiDownload } from 'react-icons/fi';
import config from '../../../config';

const ResultsUpload = () => {
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
    if (!file || !programCode) {
      setError('Please select a file and ensure a program is selected');
      return;
    }

    setUploading(true);
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
    const csvContent = "University Id,Student Name,Academic Year,Semester,Attempt CREDITS,OBTAINED CREDITS,22UC1101,22MT1101,22SC1101,22ME1103,22EC1101\n2200080001,JOHN DOE,2022-23,1,20,18,A+|2|1-mandatory,O|4.5|1-mandatory,A|5.5|1-mandatory,B+|2|1-mandatory,A|4|1-mandatory\n2200080002,JANE SMITH,2022-23,1,20,20,O|2|1-mandatory,A+|4.5|1-mandatory,O|5.5|1-mandatory,A|2|1-mandatory,O|4|1-mandatory";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'results_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
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
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-orange-900 mb-2">Upload Instructions</h3>
            <ul className="text-sm text-orange-800 space-y-1">
              <li>• Upload a CSV file containing student results and grades</li>
              <li>• Required columns: University Id, Student Name, Academic Year, Semester, Attempt CREDITS, OBTAINED CREDITS</li>
              <li>• Course columns should follow format: Grade|Credits|Type (e.g., A+|4|1-mandatory)</li>
              <li>• File size limit: 50MB (larger files supported for results)</li>
              <li>• Results will be associated with the current program</li>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
                    <p className="text-xs text-gray-500">CSV files only (up to 50MB)</p>
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
                  <span className="text-gray-600 ml-2">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
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
              onClick={handleUpload}
              disabled={uploading}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <FiUpload className="h-4 w-4" />
                  Upload Results
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsUpload;
