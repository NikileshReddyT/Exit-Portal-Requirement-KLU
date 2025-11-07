import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FiBook, FiCheckCircle, FiChevronDown } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/layout/Navbar';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import config from '../config';
import { CategoryDetailsSkeleton } from '../components/skeletons/CategoryDetailsSkeleton';


const CourseCard = ({ course }) => {
    const promoUpper = (course.promotion || '').toUpperCase();
    const isPassed = promoUpper === 'P';
    const isRegistered = promoUpper === 'R';

    const badgeClass = isPassed
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : isRegistered
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-white text-gray-600 border-gray-300';

    const badgeText = isPassed
        ? `Grade: ${course.grade ?? '-'}`
        : isRegistered
            ? 'Registered'
            : course.promotion || 'Attempted';

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white border-2 border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3"
        >
            <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 leading-snug break-words">{course.courseName}</p>
                <p className="text-[11px] text-gray-500 font-mono mt-0.5">{course.courseCode}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeClass}`}>
                {badgeText}
            </span>
        </motion.div>
    );
};

const AvailableCourseCard = ({ course }) => (
    <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white border-2 border-gray-200 rounded-lg p-2.5 flex items-center gap-3"
    >
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
            <FiBook className="text-gray-500 text-sm" />
        </div>
        <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-900 truncate">{course.courseTitle}</p>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">{course.courseCode}</p>
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
                    axios.get(`${config.backendUrl}/api/v1/frontend/getallcourses/${encodedCategoryName}`,
                        { params: { studentId: user.universityId } }
                    )
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

    // Courses that count towards progress (only those with promotion 'P')
    const promotedCourses = useMemo(
        () => completedCourses.filter(c => (c.promotion || '').toUpperCase() === 'P'),
        [completedCourses]
    );

    const registeredCourses = useMemo(
        () => completedCourses.filter(c => (c.promotion || '').toUpperCase() === 'R'),
        [completedCourses]
    );

    const availableCourses = useMemo(() => {
        // Exclude only the courses that were promoted (passed). Non-'P' attempts remain available
        const passedCodes = new Set(promotedCourses.map(c => c.courseCode));
        const passedNames = new Set(promotedCourses.map(c => c.courseTitle));
        return allCourses.filter(course => 
            !passedCodes.has(course.courseCode) && 
            !passedNames.has(course.courseTitle)
        );
    }, [promotedCourses, allCourses]);

    const [openAccordions, setOpenAccordions] = useState({});

    const toggleAccordion = (key) => {
        setOpenAccordions(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

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

    useEffect(() => {
        const keys = Object.keys(sortedAndGroupedCourses);
        if (!keys.length) return;

        setOpenAccordions(prev => {
            if (Object.keys(prev).length) return prev;
            return { [`accordion-${keys[0]}`]: true };
        });
    }, [sortedAndGroupedCourses]);

    if (loading) {
        return <CategoryDetailsSkeleton />;
    }

    if (error) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-red-500 font-semibold">{error}</div>;
    }

    const promotedCount = promotedCourses.length;
    const registeredCount = registeredCourses.length;
    const remainingCount = Math.max(0, minRequiredCourses - promotedCount - registeredCount);

    const completedPct = minRequiredCourses > 0 ? (promotedCount / minRequiredCourses) * 100 : 0;
    const registeredPct = minRequiredCourses > 0 ? (registeredCount / minRequiredCourses) * 100 : 0;
    const totalPct = completedPct + registeredPct;

    const isCompleted = minRequiredCourses > 0 && promotedCount >= minRequiredCourses;
    const isOnTrack = !isCompleted && (promotedCount + registeredCount) >= minRequiredCourses;

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <Navbar />
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-4 sm:mb-6">
                        <Breadcrumbs
                            items={[
                                { label: 'Dashboard', to: '/dashboard' },
                                { label: 'Categories', to: '/categories' },
                                { label: decodeURIComponent(categoryName) }
                            ]}
                        />
                    </div>

                    <h1
                        className="text-2xl sm:text-3xl font-extrabold text-brand-charcoal tracking-tight leading-snug break-words text-center md:text-left md:py-4 md:px-2 mb-4"
                        title={decodeURIComponent(categoryName)}
                    >
                        {decodeURIComponent(categoryName)}
                    </h1>

                    {/* Summary Section */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="bg-white p-5 rounded-xl border-2 border-gray-200 mb-6"
                    >
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Progress overview</p>
                                    <p className="text-lg font-bold text-gray-900 mt-1">
                                        {promotedCount} completed • {registeredCount} registered • {minRequiredCourses} required
                                    </p>
                                </div>
                                <span
                                    className={`px-3 py-1 rounded-lg text-xs font-bold border-2 ${
                                        isCompleted
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : isOnTrack
                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                : 'bg-white text-gray-700 border-gray-300'
                                    }`}
                                >
                                    {isCompleted ? '✓ Complete' : isOnTrack ? '⏳ On Track' : '○ In Progress'}
                                </span>
                            </div>

                            <div>
                                <div className="relative w-full h-8 bg-gray-50 rounded-lg overflow-hidden border-2 border-gray-200">
                                    {/* Completed */}
                                    <motion.div
                                        className={`absolute left-0 top-0 h-full ${
                                            isCompleted
                                                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                                                : 'bg-gradient-to-r from-rose-500 to-rose-600'
                                        } flex items-center justify-center`}
                                        initial={{ width: '0%' }}
                                        animate={{ width: `${Math.min(100, completedPct)}%` }}
                                        transition={{ duration: 0.8, ease: 'easeOut' }}
                                    >
                                        {completedPct > 12 && <span className="text-white text-xs font-bold">{promotedCount}</span>}
                                    </motion.div>

                                    {/* Registered */}
                                    {registeredCount > 0 && (
                                        <motion.div
                                            className="absolute top-0 h-full bg-gradient-to-r from-amber-400 to-amber-500 flex items-center justify-center"
                                            style={{ left: `${completedPct}%` }}
                                            initial={{ width: '0%' }}
                                            animate={{ width: `${Math.min(100 - completedPct, registeredPct)}%` }}
                                            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
                                        >
                                            {registeredPct > 10 && <span className="text-white text-xs font-bold">{registeredCount}</span>}
                                        </motion.div>
                                    )}

                                    {/* Remaining */}
                                    {remainingCount > 0 && (
                                        <motion.div
                                            className="absolute top-0 h-full bg-gradient-to-r from-gray-200 to-gray-300 flex items-center justify-center"
                                            style={{ left: `${totalPct}%` }}
                                            initial={{ width: '0%' }}
                                            animate={{ width: `${Math.min(100 - totalPct, (remainingCount / minRequiredCourses) * 100)}%` }}
                                            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                                        >
                                            {((remainingCount / minRequiredCourses) * 100) > 10 && (
                                                <span className="text-gray-700 text-xs font-bold">{remainingCount}</span>
                                            )}
                                        </motion.div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between mt-2 text-xs font-semibold text-gray-600">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-2.5 h-2.5 rounded-sm ${isCompleted ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                            <span>Done: {promotedCount}</span>
                                        </div>
                                        {registeredCount > 0 && (
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                                                <span>Registered: {registeredCount}</span>
                                            </div>
                                        )}
                                        {remainingCount > 0 && (
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2.5 h-2.5 rounded-sm bg-gray-300" />
                                                <span>Remaining: {remainingCount}</span>
                                            </div>
                                        )}
                                    </div>
                                    <span className="font-bold">{minRequiredCourses} total</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        
                        {/* Completed Courses Section */}
                        <div className="lg:col-span-2">
                            <h2 className="text-lg font-bold text-gray-900 mb-3">Your Courses</h2>
                            {Object.keys(sortedAndGroupedCourses).length > 0 ? (
                                <div className="space-y-2">
                                    {Object.entries(sortedAndGroupedCourses).map(([year, courses]) => {
                                        const key = `accordion-${year}`;
                                        const open = !!openAccordions[key];

                                        return (
                                            <motion.div
                                                key={year}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.25 }}
                                                className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAccordion(key)}
                                                    className="btn w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3 text-left">
                                                        <span className="text-sm font-bold text-gray-900">{year}</span>
                                                        <span className="text-xs text-gray-500 font-medium">{courses.length} {courses.length === 1 ? 'course' : 'courses'}</span>
                                                    </div>
                                                    <motion.span
                                                        animate={{ rotate: open ? 180 : 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="text-gray-400"
                                                    >
                                                        <FiChevronDown size={16} />
                                                    </motion.span>
                                                </button>
                                                <AnimatePresence initial={false}>
                                                    {open && (
                                                        <motion.div
                                                            key="content"
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="px-4 pb-3 space-y-2 bg-gray-50"
                                                        >
                                                            {courses.map(course => (
                                                                <CourseCard key={course.courseCode} course={course} />
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 px-6 bg-white border-2 border-gray-200 rounded-lg">
                                    <FiBook className="mx-auto text-4xl text-gray-300 mb-3" />
                                    <p className="text-sm text-gray-500">No completed courses in this category yet.</p>
                                </div>
                            )}
                        </div>

                        {/* Available Courses */}
                        <div className="lg:col-span-1">
                            <h2 className="text-lg font-bold text-gray-900 mb-3">Available Courses</h2>
                            {availableCourses.length > 0 ? (
                                <div className="space-y-2 bg-white border-2 border-gray-200 rounded-lg p-3">
                                    {availableCourses.map(course => (
                                        <AvailableCourseCard key={course.courseCode} course={course} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 px-6 bg-white border-2 border-gray-200 rounded-lg">
                                    <FiCheckCircle className="mx-auto text-4xl text-emerald-400 mb-3" />
                                    <p className="text-sm text-gray-500">All available courses have been completed!</p>
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
