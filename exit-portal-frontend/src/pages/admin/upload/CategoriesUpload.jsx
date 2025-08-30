import React, { useState } from 'react';
import { useProgramContext } from '../../../context/ProgramContext';
import { FiUpload, FiFileText, FiAlertCircle, FiCheckCircle, FiDownload } from 'react-icons/fi';
import config from '../../../config';

const CategoriesUpload = () => {
  const { programId, programInfo } = useProgramContext();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setError('');
      setUploadResult(null);
    } else {
      setError('Please select a valid CSV file');
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !programId) {
      setError('Please select a file and ensure a program is selected');
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('programId', programId);

    try {
      const response = await fetch(`${config.backendUrl}/api/admin/upload/categories`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.text();
        setUploadResult({ success: true, message: result });
        setFile(null);
        // Reset file input
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
    // Create a sample CSV template
    const csvContent = "Category ID,Category Name,Description\nCAT001,Mathematics,Core Mathematics Category\nCAT002,Science,General Science Category";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'categories_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiFileText className="h-6 w-6 text-blue-600" />
            Categories Upload
          </h1>
          {programInfo && (
            <p className="text-sm text-gray-600 mt-1">
              Uploading to: <span className="font-medium">{programInfo.name}</span>
            </p>
          )}
        </div>

        <div className="p-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-blue-900 mb-2">Upload Instructions</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Upload a CSV file containing category information</li>
              <li>• Required columns: Category ID, Category Name, Description</li>
              <li>• File size limit: 10MB</li>
              <li>• Categories will be associated with the current program</li>
            </ul>
          </div>

          {/* Template Download */}
          <div className="mb-6">
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <FiDownload className="h-4 w-4" />
              Download Template
            </button>
          </div>

          {/* File Upload */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select CSV File
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
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
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
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
              onClick={handleUpload}
              disabled={!file || uploading || !programId}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <FiUpload className="h-4 w-4" />
                  Upload Categories
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoriesUpload;
