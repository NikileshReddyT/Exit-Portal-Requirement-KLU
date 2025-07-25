import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { motion, AnimatePresence } from 'framer-motion';


import Navbar from '../components/layout/Navbar';
import { FiTrendingUp, FiAward, FiCheckCircle, FiXCircle, FiArrowRight, FiChevronDown } from 'react-icons/fi';
import PdfDownloadButton from '../components/ui/PdfDownloadButton';
import CategoryList from '../components/dashboard/CategoryList';
import Summary, { ProgressCircle, SummaryCards } from '../components/dashboard/Summary';
import { DashboardSkeleton } from '../components/skeletons/DashboardSkeleton';


const Dashboard = () => {
    
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const { studentProgressData, loadingProgress, error } = useData();
    

    const [isSummaryOpen, setIsSummaryOpen] = useState(false);
    const [isCategoriesOpen, setIsCategoriesOpen] = useState(true);

    const loading = loadingProgress === 'pending';
    // const loading = true;

    const { summaryData, categories, noDataFound } = useMemo(() => {
        if (!studentProgressData || studentProgressData.length === 0) {
            return { summaryData: null, categories: [], noDataFound: true };
        }

        const data = studentProgressData;
        const totalCategories = data.length;
        const completedCategories = data.filter(cat => cat.completedCourses >= cat.minRequiredCourses).length;
        const totalRequiredCredits = data.reduce((acc, cat) => acc + cat.minRequiredCredits, 0);
        const totalCompletedCredits = data.reduce((acc, cat) => acc + cat.completedCredits, 0);

        const summary = {
            totalCompletedCredits,
            totalRequiredCredits,
            isCertificateEligible: data.every(cat => cat.completedCourses >= cat.minRequiredCourses),
            isSpecializationCompleted: (data.slice(5, 10) || []).every(cat => cat.completedCourses >= cat.minRequiredCourses),
            totalCategories,
            completedCategories
        };

        return { summaryData: summary, categories: data, noDataFound: false };
    }, [studentProgressData]);

    const overallProgress = summaryData ? (summaryData.totalCompletedCredits / summaryData.totalRequiredCredits) * 100 : 0;

    const handleNavigateToDetails = (categoryName) => {
        navigate(`/category/${encodeURIComponent(categoryName)}`);
    };

    const containerVariants = {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { staggerChildren: 0.1 } },
    };

    const itemVariants = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
    };

    if (loading) {
        return <DashboardSkeleton />

    }

    if (noDataFound) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                <Navbar />
                <main className="flex-1 flex items-center justify-center text-center p-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="bg-white p-8 rounded-xl shadow-lg max-w-md"
                    >
                        <h2 className="text-2xl font-bold text-brand-charcoal mb-3">Welcome!</h2>
                        <p className="text-gray-600 mb-6">
                            Your academic data is not yet available in the portal. This is common for new students whose records are being processed.
                        </p>
                        <p className="text-gray-500 text-sm">
                            If you believe this is an error, please contact the administration office.
                        </p>
                    </motion.div>
                </main>
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
            <Navbar />
            <main className="p-4 sm:p-6 lg:p-8">
                <motion.div
                    variants={containerVariants}
                    initial="initial"
                    animate="animate"
                    className="max-w-7xl mx-auto"
                >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                        <motion.div variants={itemVariants}>
                            <h1 className="text-3xl font-bold text-brand-charcoal">Welcome, {user?.name}</h1>
                            <p className="text-gray-500 mt-1">Here's your academic progress overview.</p>
                        </motion.div>
                        <motion.div variants={itemVariants} className="mt-4 sm:mt-0 hidden md:block">
                            <PdfDownloadButton studentId={user?.universityId} />
                        </motion.div>
                    </div>
                    {/* Mobile-only Progress Circle */}
                    <div className="md:hidden mb-6 flex justify-center">
                        {summaryData && <ProgressCircle overallProgress={overallProgress} />}
                    </div>

                    {/* Summary Section */}
                    <motion.div variants={itemVariants} className="mb-8">
                        {/* Desktop Summary */}
                        <div className="hidden md:block">
                            {summaryData && <Summary summary={summaryData} />}
                        </div>

                        {/* Mobile Accordion for Summary Cards*/}
                        <div className="md:hidden bg-white rounded-lg shadow-sm">
                            <div
                                className="flex justify-between items-center p-4 cursor-pointer"
                                onClick={() => setIsSummaryOpen(!isSummaryOpen)}
                            >
                                <h2 className="text-xl font-bold text-brand-charcoal">Academic Summary</h2>
                                <motion.div animate={{ rotate: isSummaryOpen ? 0 : -90 }} transition={{ duration: 0.2 }}>
                                    <FiChevronDown className="w-6 h-6 text-gray-500" />
                                </motion.div>
                            </div>

                            <AnimatePresence>
                                {isSummaryOpen && (
                                    <motion.div
                                        key="summary-cards-content"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1, transition: { duration: 0.3 } }}
                                        exit={{ height: 0, opacity: 0, transition: { duration: 0.3 } }}
                                        className="overflow-hidden"
                                    >
                                        <div className="p-4 pt-0">
                                            <SummaryCards summary={summaryData} />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="mb-8 md:hidden">
                        <PdfDownloadButton studentId={user?.universityId} />
                    </motion.div>

                    {/* Categories Preview Section */}
                    <motion.div variants={itemVariants} className="bg-white md:bg-transparent rounded-lg shadow-sm md:shadow-none">
                        {/* Unified Requirement Categories Header */}
                        <div className="flex justify-between items-center mb-4 bg-white px-4 py-3 rounded-lg gap-2 flex-col sm:flex-row">
                            <h2 className="text-xl md:text-2xl font-bold text-brand-charcoal">Requirement Categories</h2>
                            <Link to="/categories" className="group flex items-center font-semibold hover:underline text-sm md:text-base bg-red-900 sm:bg-transparent sm:text-red-900 sm:text-brand-red text-white px-3 py-2 rounded">
                                <span>View All</span>
                                <FiArrowRight className="ml-1 md:ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                            </Link>
                        </div>
                        
                        {/* Content - Collapsible on mobile, always visible on desktop */}
                        <div className="block">
                            <AnimatePresence>
                                {isCategoriesOpen && (
                                    <motion.div
                                        key="categories-content"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1, transition: { duration: 0.3 } }}
                                        exit={{ height: 0, opacity: 0, transition: { duration: 0.3 } }}
                                        className="overflow-hidden md:overflow-visible md:h-auto"
                                    >
                                        <div className="md:pt-0 p-4 pt-0">
                                            <CategoryList categories={categories.slice(0, 3)} onShowPopup={handleNavigateToDetails} />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </motion.div>
            </main>
        </div>
    );
};

export default Dashboard;
