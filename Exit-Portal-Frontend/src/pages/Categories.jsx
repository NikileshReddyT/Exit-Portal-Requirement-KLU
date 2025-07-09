import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { FiSearch } from 'react-icons/fi';
import config from '../config';

import Navbar from '../components/layout/Navbar';
import CategoryList from '../components/dashboard/CategoryList';


const Categories = () => {
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const studentId = localStorage.getItem('studentId');
    if (!studentId) {
      navigate('/');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.post(`${config.backendUrl}/api/v1/frontend/getdata`, { universityid: studentId });
        const data = response.data;

        if (data && data.length > 0) {
          setStudent({
            name: data[0].studentName,
            universityId: data[0].universityId,
          });
          setCategories(data);
        } else {
          setStudent({ name: 'Student', universityId: studentId });
          setCategories([]);
        }

      } catch (err) {
        setError('Failed to load categories. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleNavigateToDetails = (categoryName) => {
    navigate(`/category/${encodeURIComponent(categoryName)}`);
  };

  const filteredCategories = categories.filter(category =>
    category.categoryName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-brand-charcoal">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-brand-red border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-50 text-red-700">
        <p className="text-2xl font-semibold">Oops! Something went wrong.</p>
        <p className="mt-2">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-brand-red text-white rounded-lg shadow hover:bg-red-700 transition">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar student={student} />
      <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <h1 className="text-3xl font-extrabold text-brand-charcoal tracking-tight">Categories</h1>
              <div className="relative w-full md:w-64">
                <FiSearch className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-red focus:border-transparent transition"
                />
              </div>
            </div>

                        <CategoryList categories={filteredCategories} onShowPopup={handleNavigateToDetails} />

          </motion.div>
        </div>
      </main>

    </div>
  );
};

export default Categories;