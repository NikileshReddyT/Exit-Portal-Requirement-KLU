import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FiCheckCircle, FiLoader, FiArrowRight } from 'react-icons/fi';

const CategoryCard = ({ category, index }) => {
    const {
        categoryName,
        minRequiredCourses,
        completedCourses,
        minRequiredCredits,
        completedCredits,
    } = category;

    const coursesProgress = minRequiredCourses > 0
        ? (completedCourses / minRequiredCourses) * 100
        : (completedCourses > 0 ? 100 : 0);
    const isCategoryCompleted = coursesProgress >= 100;

    const cardVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, ease: 'easeOut', delay: index * 0.05 },
        },
    };

    return (
        <Link
            to={`/category/${encodeURIComponent(categoryName)}`}
            state={{ minRequiredCourses: minRequiredCourses }}
            className="block h-full"
        >
            <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full cursor-pointer border border-gray-200/80 group"
            >
                <div className="p-6 flex-grow flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-brand-charcoal pr-4 w-2/3 ">{categoryName}</h3>
                            {isCategoryCompleted ? (
                                <div className="flex items-center gap-2 text-green-500">
                                    <FiCheckCircle size={20} />
                                    <span className="font-semibold text-sm">Completed</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-red-900">
                                    <FiLoader size={20} className="animate-spin" style={{ animationDuration: '3s' }}/>
                                    <span className="font-semibold text-sm">In Progress</span>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-6 items-start">
                            <div className="text-center">
                                <p className="text-sm text-gray-500 mb-1">Courses</p>
                                <p className="text-2xl font-bold text-brand-charcoal">
                                    {completedCourses}<span className="text-base font-medium text-gray-400"> / {minRequiredCourses}</span>
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-500 mb-1">Credits</p>
                                <p className="text-2xl font-bold text-brand-charcoal">
                                    {completedCredits}<span className="text-base font-medium text-gray-400"> / {minRequiredCredits}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 relative mb-2">
                             <motion.div
                                className={`h-2.5 rounded-full ${isCategoryCompleted ? 'bg-green-400' : 'bg-red-900'}`}
                                initial={{ width: '0%' }}
                                whileInView={{ width: `${Math.min(100, coursesProgress)}%` }}
                                viewport={{ once: true, amount: 0.5 }}
                                transition={{ duration: 1, ease: 'easeInOut' }}
                            />
                            <motion.div 
                                className={`absolute top-1/2 -translate-y-1/2 h-[13px] w-[13px] rounded-full ${isCategoryCompleted ? 'bg-green-400' : 'bg-red-900'}`}
                                initial={{ left: '0%' }}
                                whileInView={{ left: `${Math.min(100, coursesProgress)-2}%` }}
                                viewport={{ once: true, amount: 0.5 }}
                                transition={{ duration: 1, ease: 'easeInOut' }}
                            />
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-500">
                            <span>Overall Progress</span>
                            <span className="font-semibold text-brand-charcoal">{`${Math.round(coursesProgress)}%`}</span>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-50 rounded-b-2xl mt-auto px-6 py-3 border-t border-gray-200/80">
                    <div className="flex items-center justify-center text-brand-red font-semibold text-sm group-hover:text-red-700 transition-colors duration-300">
                        <span>View Details</span>
                        <FiArrowRight className="ml-2 transform transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                </div>
            </motion.div>
        </Link>
    );
};

export default CategoryCard;