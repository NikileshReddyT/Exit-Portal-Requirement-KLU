import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FiArrowLeft, FiBook, FiCheckCircle } from 'react-icons/fi';
import { motion } from 'framer-motion';
import Navbar from '../components/layout/Navbar';
import config from '../config';
import { CategoryDetailsSkeleton } from '../components/skeletons/CategoryDetailsSkeleton';


const CourseCard = ({ course }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center relative"
    >
        <div className="flex flex-col w-full pr-16">
            <p className="font-bold text-brand-charcoal text-sm sm:text-base">{course.courseName}</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">{course.courseCode}</p>
        </div>
        <div className="absolute top-2 right-2">
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${course.grade === 'P' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                Grade : {course.grade}
            </span>
        </div>
    </motion.div>
);

const AvailableCourseCard = ({ course }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white p-3 rounded-lg border border-gray-300/80 hover:shadow-md hover:border-red-200 transition-all duration-300 flex items-center gap-4 cursor-pointer"
    >
        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
            <FiBook className="text-red-600" />
        </div>
        <div className="flex-grow">
            <p className="font-semibold text-brand-charcoal text-sm">{course.courseTitle}</p>
            <p className="text-xs text-gray-500 font-mono mt-1">{course.courseCode}</p>
        </div>
    </motion.div>
);

const CategoryDetailsPage = () => {
    const { categoryName } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    const [completedCourses, setCompletedCourses] = useState([]);
    const [minRequiredCourses, setMinRequiredCourses] = useState(0);
    const [allCourses, setAllCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    useEffect(() => {
        if (!user) {
            navigate('/');
            return;
        }

        if (location.state && location.state.minRequiredCourses) {
            setMinRequiredCourses(location.state.minRequiredCourses);
        }

        const fetchData = async () => {
            setLoading(true);
            const encodedCategoryName = encodeURIComponent(categoryName);
            try {
                const [completedRes, allCoursesRes] = await Promise.all([
                    axios.get(`${config.backendUrl}/api/v1/frontend/getcategorydetails/${encodedCategoryName}/${user.universityId}`),
                    axios.get(`${config.backendUrl}/api/v1/frontend/getallcourses/${encodedCategoryName}`)
                ]);

                setCompletedCourses(completedRes.data || []);
                setAllCourses(allCoursesRes.data || []);

            } catch (err) {
                setError('Failed to load category details. Please try again later.');
                console.error('API Error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [categoryName, navigate, location.state, user]);

    const availableCourses = useMemo(() => {
        const completedCourseCodes = new Set(completedCourses.map(c => c.courseCode));
        const completedCourseNames = new Set(completedCourses.map(c => c.courseName));
        return allCourses.filter(course => 
            !completedCourseCodes.has(course.courseCode) && 
            !completedCourseNames.has(course.courseTitle)
        );
    }, [completedCourses, allCourses]);

    const sortedAndGroupedCourses = useMemo(() => {
        const semesterOrder = { 'Odd Sem': 1, 'Even Sem': 2, 'Summer Term': 3 };

        const sorted = [...completedCourses].sort((a, b) => {
            if (!a.year || !b.year) return 0;

            const yearA = parseInt(a.year.split('-')[0]);
            const yearB = parseInt(b.year.split('-')[0]);

            if (yearA !== yearB) {
                return yearB - yearA; // Sort by year descending
            }

            if (!a.semester || !b.semester) return 0;
            return semesterOrder[a.semester] - semesterOrder[b.semester];
        });

        return sorted.reduce((acc, course) => {
            const year = course.year || 'Uncategorized';
            if (!acc[year]) {
                acc[year] = [];
            }
            acc[year].push(course);
            return acc;
        }, {});
    }, [completedCourses]);

    if (loading) {
        return <CategoryDetailsSkeleton />;
    }

    if (error) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-red-500 font-semibold">{error}</div>;
    }

    const completedCount = completedCourses.length;
    const pendingCount = Math.max(0, minRequiredCourses - completedCount);
    const progressPercentage = minRequiredCourses > 0 ? (completedCount / minRequiredCourses) * 100 : 0;

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <Navbar />
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    <button 
                        onClick={() => navigate('/categories')}
                        className="flex items-center gap-2 text-brand-charcoal hover:text-brand-red font-semibold mb-6 transition-colors duration-300"
                    >
                        <FiArrowLeft />
                        Back to Categories
                    </button>

                    <h1 className="text-3xl font-extrabold text-brand-charcoal tracking-tight">{decodeURIComponent(categoryName)}</h1>

                    {/* Summary Section */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="bg-white p-6 rounded-2xl shadow-sm mb-8"
                    >
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="text-center md:text-left">
                                <p className="text-gray-500 text-sm">Progress</p>
                                <p className="text-3xl font-bold text-brand-charcoal">
                                    {completedCount} / {minRequiredCourses} <span className="text-xl font-medium">Courses Completed</span>
                                </p>
                                <p className="text-gray-500 text-sm mt-1">
                                    You need to complete {pendingCount} more courses in this category.
                                </p>
                            </div>
                            <div className="w-full md:w-1/3">
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <motion.div
                                        className="bg-red-900 h-2.5 rounded-full"
                                        initial={{ width: '0%' }}
                                        animate={{ width: `${progressPercentage}%` }}
                                        transition={{ duration: 1, ease: 'easeInOut' }}
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        {/* Completed Courses Section */}
                        <div className="lg:col-span-2">
                            <h2 className="text-2xl font-bold text-brand-charcoal mb-4">Completed Courses</h2>
                            {Object.keys(sortedAndGroupedCourses).length > 0 ? (
                                 <div className="space-y-8">
                                {Object.entries(sortedAndGroupedCourses).map(([year, courses]) => (
                                     <motion.div 
                                        key={year}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5 }}
                                    >
                                        <h3 className="text-xl font-semibold text-gray-700 mb-4 pb-2 border-b-2 border-gray-200">{year}</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {courses.map(course => <CourseCard key={course.courseCode} course={course} />)}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                            ) : (
                                <div className="text-center py-10 px-6 bg-white rounded-lg shadow-sm">
                                    <FiBook className="mx-auto text-5xl text-gray-300" />
                                    <p className="mt-4 text-gray-500">No completed courses in this category yet.</p>
                                </div>
                            )}
                        </div>

                        {/* Available Courses Section */}
                        <div className="lg:col-span-1">
                            <h2 className="text-2xl font-bold text-brand-charcoal mb-4">Available Courses</h2>
                            {availableCourses.length > 0 ? (
                                <div className="space-y-3 bg-gray-50/80 p-4 rounded-lg shadow-inner border border-gray-300">
                                    {availableCourses.map(course => (
                                        <AvailableCourseCard key={course.courseCode} course={course} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-10 px-6 bg-white rounded-lg shadow-sm">
                                    <FiCheckCircle className="mx-auto text-5xl text-green-400" />
                                    <p className="mt-4 text-gray-500">All available courses in this category have been completed.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CategoryDetailsPage;
