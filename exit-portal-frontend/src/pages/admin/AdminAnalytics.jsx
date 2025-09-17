import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { FiSearch, FiDatabase, FiLoader, FiAlertCircle, FiCheckCircle, FiInfo, FiCopy, FiMessageSquare, FiZap, FiTrendingUp, FiEye, FiClock, FiRefreshCw, FiDownload, FiFilter, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const AdminAnalytics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [schema, setSchema] = useState(null);
  const [showSchema, setShowSchema] = useState(false);
  const [queryHistory, setQueryHistory] = useState([]);
  const [clarificationQuestion, setClarificationQuestion] = useState('');
  const [originalQuery, setOriginalQuery] = useState('');
  const [showClarification, setShowClarification] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const textareaRef = useRef(null);

  useEffect(() => {
    console.log('🔧 Analytics Component Initialized:', {
      user: user ? { userType: user.userType, name: user.name } : null,
      backendUrl: config.backendUrl,
      timestamp: new Date().toISOString()
    });

    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SUPER_ADMIN')) {
      console.log('❌ User not authorized for analytics');
      navigate('/login');
      return;
    }
    fetchSchema();
  }, [user, navigate]);

  const fetchSchema = async () => {
    const requestUrl = `${config.backendUrl}/api/analytics/schema`;
    
    console.log('🔍 Schema Request:', {
      url: requestUrl,
      method: 'GET',
      timestamp: new Date().toISOString()
    });

    try {
      const response = await axios.get(requestUrl, {
        withCredentials: true,
        timeout: 10000
      });
      
      console.log('✅ Schema Response:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        timestamp: new Date().toISOString()
      });
      
      setSchema(response.data);
    } catch (err) {
      console.error('❌ Schema Request Failed:', {
        error: err.message,
        response: err.response ? {
          status: err.response.status,
          statusText: err.response.statusText,
          data: err.response.data
        } : 'No response received',
        timestamp: new Date().toISOString()
      });
    }
  };

  const executeQuery = async (refinedQuery = null) => {
    const queryToExecute = refinedQuery || query.trim();
    if (!queryToExecute) return;
    
    setLoading(true);
    setError('');
    setResults(null);
    setShowClarification(false);

    const requestData = { query: queryToExecute };
    const requestUrl = `${config.backendUrl}/api/analytics/query`;
    
    console.log('🚀 Analytics Request:', {
      url: requestUrl,
      method: 'POST',
      data: requestData,
      timestamp: new Date().toISOString()
    });

    try {
      const response = await axios.post(
        requestUrl,
        requestData,
        { 
          withCredentials: true,
          timeout: 30000 // 30 second timeout
        }
      );

      console.log('✅ Analytics Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        timestamp: new Date().toISOString()
      });

      // Check if response contains a clarification question
      if (response.data.needsClarification) {
        console.log('❓ Clarification needed:', response.data.clarificationQuestion);
        setClarificationQuestion(response.data.clarificationQuestion);
        setOriginalQuery(queryToExecute);
        setShowClarification(true);
      } else {
        // Normal query result
        console.log('📊 Query results received:', {
          count: response.data.count,
          sql: response.data.sql,
          type: response.data.type
        });
        setResults(response.data);
        setQueryHistory(prev => [
          { query: queryToExecute, timestamp: new Date(), results: response.data },
          ...prev.slice(0, 9)
        ]);
        // Clear any previous clarification state
        setClarificationQuestion('');
        setOriginalQuery('');
        // Reset table controls
        setTableSearch('');
        setCurrentPage(1);
        setSortConfig({ key: null, direction: 'asc' });
      }
    } catch (err) {
      console.error('❌ Analytics Request Failed:', {
        error: err.message,
        response: err.response ? {
          status: err.response.status,
          statusText: err.response.statusText,
          data: err.response.data,
          headers: err.response.headers
        } : 'No response received',
        request: err.request ? {
          url: err.request.responseURL || requestUrl,
          method: 'POST'
        } : 'No request sent',
        config: {
          baseURL: err.config?.baseURL,
          url: err.config?.url,
          timeout: err.config?.timeout
        },
        timestamp: new Date().toISOString()
      });
      
      const errorMsg = err.response?.data?.error || err.message || 'Failed to execute query';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleClarificationResponse = () => {
    if (!query.trim()) return;
    
    console.log('🔄 Clarification Response:', {
      originalQuery,
      clarificationResponse: query.trim(),
      timestamp: new Date().toISOString()
    });
    
    // Combine original query with clarification response
    const refinedQuery = `${originalQuery}\n\nAdditional context: ${query.trim()}`;
    console.log('📝 Refined Query:', refinedQuery);
    executeQuery(refinedQuery);
  };

  const cancelClarification = () => {
    setShowClarification(false);
    setClarificationQuestion('');
    setOriginalQuery('');
    setQuery('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      executeQuery();
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const exampleQueries = [
    "Show all students with their program names",
    "List courses with highest average grade points",
    "Count students by program",
    "Show failed courses (promotion = 'F') by category",
    "List top 10 students by GPA",
    "Show category completion rates",
    "Find students who need to complete more than 2 categories",
    "List all course codes and titles with credit hours"
  ];

  const exportToCSV = (data, filename = 'analytics_results.csv') => {
    if (!data || data.length === 0) return;
    
    const columns = Object.keys(data[0]);
    const csvContent = [
      columns.join(','),
      ...data.map(row => 
        columns.map(col => {
          const value = row[col];
          return value !== null && value !== undefined ? `"${String(value).replace(/"/g, '""')}"` : '';
        }).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getFilteredAndSortedData = (data) => {
    if (!data || data.length === 0) return [];

    let filteredData = data;

    // Apply search filter
    if (tableSearch) {
      filteredData = data.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(tableSearch.toLowerCase())
        )
      );
    }

    // Apply sorting
    if (sortConfig.key) {
      filteredData.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        
        if (sortConfig.direction === 'asc') {
          return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
        } else {
          return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
        }
      });
    }

    return filteredData;
  };

  const renderTable = (data) => {
    if (!data || data.length === 0) return <div className="text-gray-500 text-center py-8">No results found</div>;

    const columns = Object.keys(data[0]);
    const filteredData = getFilteredAndSortedData(data);
    
    // Pagination
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentData = filteredData.slice(startIndex, endIndex);
    
    return (
      <div className="space-y-4">
        {/* Table Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-gray-50 p-4 rounded-xl">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search results..."
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
              />
            </div>
            
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => exportToCSV(filteredData)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-medium"
            >
              <FiDownload />
              Export CSV
            </button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="text-sm text-gray-600">
          Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} results
          {tableSearch && ` (filtered from ${data.length} total)`}
        </div>

        {/* Table */}
        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                {columns.map(col => (
                  <th 
                    key={col} 
                    className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort(col)}
                  >
                    <div className="flex items-center gap-2">
                      {col.replace(/_/g, ' ')}
                      {sortConfig.key === col && (
                        <span className="text-blue-600">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentData.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  {columns.map(col => (
                    <td key={col} className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                      {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-xl">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <FiChevronLeft />
                Previous
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-2 rounded-lg ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                {totalPages > 5 && (
                  <>
                    <span className="px-2">...</span>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      className={`px-3 py-2 rounded-lg ${
                        currentPage === totalPages
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Next
                <FiChevronRight />
              </button>
            </div>
            
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FiDatabase className="text-red-600" />
              AI Powered Database Query System
            </h2>
            <p className="text-gray-600 mt-1">Ask questions about your data in plain English</p>
          </div>
          <button
            onClick={() => setShowSchema(!showSchema)}
            className="btn px-4 py-2 bg-red-50 text-red-700 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-2"
          >
            <FiEye />
            {showSchema ? 'Hide Schema' : 'Show Schema'}
          </button>
        </div>
      </div>

      {/* Schema Information */}
      {showSchema && schema && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Database Schema</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(schema.tables).map(([tableName, tableInfo]) => (
              <div key={tableName} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-600 mb-2">{tableName}</h4>
                <p className="text-sm text-gray-600 mb-3">{tableInfo.description}</p>
                <div className="space-y-1">
                  {Object.entries(tableInfo.columns).map(([colName, colType]) => (
                    <div key={colName} className="flex justify-between text-sm">
                      <span className="font-mono text-gray-700">{colName}</span>
                      <span className="text-gray-500">{colType}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Query Input */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter your question
            </label>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., Show me all students in the Computer Science program with their GPAs..."
                className="w-full h-24 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                disabled={loading}
              />
              <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                Ctrl+Enter to execute
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => executeQuery()}
              disabled={!query.trim() || loading}
              className="btn px-6 py-2 bg-red-700 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <FiLoader className="animate-spin" /> : <FiSearch />}
              {loading ? 'Executing...' : 'Execute Query'}
            </button>
            
            <button
              onClick={() => setQuery('')}
              className="btn px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Example Queries - Only show if no results */}
        {!results && !showClarification && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Example queries:</h4>
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => setQuery(example)}
                  className="btn text-xs px-3 py-1 bg-gray-50 text-gray-600 border border-gray-200 rounded-full hover:bg-gray-100"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Clarification Question */}
      {showClarification && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <FiInfo className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-amber-800 font-medium mb-2">Need More Information</h4>
              <p className="text-amber-700 mb-4">{clarificationQuestion}</p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-amber-700 mb-1">
                    Your response:
                  </label>
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Please provide the additional information requested above..."
                    className="w-full h-20 px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                    disabled={loading}
                  />
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleClarificationResponse}
                    disabled={!query.trim() || loading}
                    className="btn px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? <FiLoader className="animate-spin" /> : <FiSearch />}
                    {loading ? 'Processing...' : 'Submit Response'}
                  </button>
                  
                  <button
                    onClick={cancelClarification}
                    className="btn px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FiAlertCircle className="text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-red-800 font-medium">
                {error.includes('quota') ? 'API Quota Exceeded' : 'Query Error'}
              </h4>
              <p className="text-red-700 text-sm mt-1">{error}</p>
              {error.includes('quota') && (
                <div className="mt-2 text-xs text-red-600">
                  <p>• Try again in a few minutes</p>
                  <p>• Consider upgrading your Gemini API plan for higher limits</p>
                  <p>• Use simpler queries to reduce API calls</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FiCheckCircle className="text-green-500" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Query Results</h3>
                  <p className="text-sm text-gray-600">{results.count} rows returned</p>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(results.sql)}
                className="btn text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1"
              >
                <FiCopy />
                Copy SQL
              </button>
            </div>
            
            {results.sql && (
              <div className="mt-4 p-3 bg-gray-50 rounded border">
                <p className="text-xs text-gray-500 mb-1">Generated SQL:</p>
                <code className="text-sm font-mono text-gray-800">{results.sql}</code>
              </div>
            )}
          </div>
          
          <div className="p-6">
            {renderTable(results.results)}
          </div>
        </div>
      )}

      {/* Query History */}
      {queryHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Queries</h3>
          <div className="space-y-3">
            {queryHistory.slice(0, 5).map((item, idx) => (
              <div key={idx} className="border border-gray-200 rounded p-3 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{item.query}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {item.timestamp.toLocaleString()} • {item.results.count} rows
                    </p>
                  </div>
                  <button
                    onClick={() => setQuery(item.query)}
                    className="btn text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                  >
                    Rerun
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAnalytics;
