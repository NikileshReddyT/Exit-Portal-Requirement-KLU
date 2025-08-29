import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { motion } from 'framer-motion';
import { FiSearch } from 'react-icons/fi';


import Navbar from '../components/layout/Navbar';
import CategoryList from '../components/dashboard/CategoryList';
import { CategoriesSkeleton } from '../components/skeletons/CategoriesSkeleton';
import Breadcrumbs from '../components/ui/Breadcrumbs';



const Categories = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { studentProgressData, loadingProgress, error } = useData();
  const [searchQuery, setSearchQuery] = useState('');

  const loading = loadingProgress === 'pending';
  // const loading = true;
  const categories = studentProgressData || [];

  const handleNavigateToDetails = (categoryName) => {
    navigate(`/category/${encodeURIComponent(categoryName)}`);
  };

  const filteredCategories = categories.filter(category =>
    category.categoryName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <CategoriesSkeleton />;
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
      <Navbar />
      <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="mb-4 sm:mb-6">
              <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Categories' }]} />
            </div>
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