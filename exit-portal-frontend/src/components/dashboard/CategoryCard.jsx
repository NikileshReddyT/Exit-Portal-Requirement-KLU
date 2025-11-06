import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FiCheckCircle, FiClock, FiAlertCircle, FiInfo } from 'react-icons/fi';

const CategoryCard = ({ category, index }) => {
    const {
        categoryName,
        minRequiredCourses,
        completedCourses,
        minRequiredCredits,
        completedCredits,
        registeredCourses = 0,
        registeredCredits = 0,
    } = category;

    // Consistent logic with AdminStudentReport
    const reqC = minRequiredCourses;
    const doneC = completedCourses;
    const regC = registeredCourses;
    const reqCr = minRequiredCredits;
    const doneCr = completedCredits;
    const regCr = registeredCredits;
    
    // Prefer backend-provided pending registrations (promotion=='R'); fallback to aggregate inference
    const prc = category?.pendingRegisteredCourses;
    const prcr = category?.pendingRegisteredCredits;
    const actualRegC = Number.isFinite(prc) ? prc : Math.max(0, regC - doneC);
    const actualRegCr = Number.isFinite(prcr) ? prcr : Math.max(0, regCr - doneCr);
    
    const pctComplete = reqC > 0 ? (doneC / reqC) * 100 : 100;
    const totalPct = reqC > 0 ? ((doneC + actualRegC) / reqC) * 100 : 0;
    
    const requirementMet = (doneC >= reqC) && (doneCr >= reqCr);
    const onTrack = !requirementMet && (doneC + actualRegC) >= reqC && (doneCr + actualRegCr) >= reqCr;
    const showRegistered = actualRegC > 0 && !requirementMet;
    const remainingCourses = Math.max(0, reqC - doneC - actualRegC);
    const remainingCredits = Math.max(0, reqCr - doneCr - actualRegCr);

    const [isHovered, setIsHovered] = useState(false);
    
    // Color logic: Green only when fully complete, red when incomplete
    const completedColor = requirementMet ? 'emerald' : 'rose';
    const completedGradient = requirementMet 
        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' 
        : 'bg-gradient-to-r from-rose-500 to-rose-600';

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
                whileHover={{ 
                    y: -4, 
                    boxShadow: '0 10px 30px -5px rgba(220, 38, 38, 0.15), 0 8px 15px -5px rgba(0, 0, 0, 0.08)',
                    transition: { duration: 0.3, ease: 'easeOut' } 
                }}
                onHoverStart={() => setIsHovered(true)}
                onHoverEnd={() => setIsHovered(false)}
                className="bg-white rounded-xl shadow-sm transition-all duration-300 flex flex-col cursor-pointer border-2 border-gray-200 hover:border-red-200 group relative overflow-hidden h-full"
            >
                
                <div className="p-4 flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <motion.h3 
                            className="text-base font-bold text-gray-900 flex-1 leading-snug"
                            animate={{ 
                                scale: isHovered ? 1.01 : 1,
                            }}
                            transition={{ duration: 0.2 }}
                        >
                            {categoryName}
                        </motion.h3>
                        <motion.div 
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-white text-gray-700 border-2 border-gray-300"
                            whileHover={{ borderColor: 'rgb(220 38 38)' }}
                            transition={{ duration: 0.2 }}
                        >
                            {requirementMet ? (
                                <><FiCheckCircle size={11} /> Done</>
                            ) : onTrack ? (
                                <><FiClock size={11} /> Track</>
                            ) : (
                                <><FiAlertCircle size={11} /> Risk</>
                            )}
                        </motion.div>
                    </div>
                    
                    {/* Multi-Segment Progress Bar with Labels */}
                    <div className="mb-4">
                        <div className="relative w-full h-7 bg-gray-50 rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm">
                            {/* Completed segment - Green only when fully complete, Red when incomplete */}
                            <motion.div
                                className={`absolute left-0 top-0 h-full ${completedGradient} flex items-center justify-center`}
                                initial={{ width: '0%' }}
                                whileInView={{ width: `${Math.min(100, pctComplete)}%` }}
                                viewport={{ once: true, amount: 0.5 }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                            >
                                {pctComplete > 15 && (
                                    <span className="text-white text-[10px] font-bold px-1">{doneC}</span>
                                )}
                            </motion.div>
                            
                            {/* Registered segment (yellow/amber) */}
                            {showRegistered && (
                                <motion.div
                                    className="absolute top-0 h-full bg-gradient-to-r from-amber-400 to-amber-500 flex items-center justify-center"
                                    style={{ left: `${pctComplete}%` }}
                                    initial={{ width: '0%' }}
                                    whileInView={{ width: `${Math.min(100 - pctComplete, (actualRegC / reqC) * 100)}%` }}
                                    viewport={{ once: true, amount: 0.5 }}
                                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
                                >
                                    {(actualRegC / reqC) * 100 > 12 && (
                                        <span className="text-white text-[10px] font-bold px-1">{actualRegC}</span>
                                    )}
                                </motion.div>
                            )}
                            
                            {/* Remaining segment (gray) */}
                            {remainingCourses > 0 && (
                                <motion.div
                                    className="absolute top-0 h-full bg-gradient-to-r from-gray-200 to-gray-300 flex items-center justify-center"
                                    style={{ left: `${totalPct}%` }}
                                    initial={{ width: '0%' }}
                                    whileInView={{ width: `${Math.min(100 - totalPct, (remainingCourses / reqC) * 100)}%` }}
                                    viewport={{ once: true, amount: 0.5 }}
                                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                                >
                                    {(remainingCourses / reqC) * 100 > 12 && (
                                        <span className="text-gray-700 text-[10px] font-bold px-1">{remainingCourses}</span>
                                    )}
                                </motion.div>
                            )}
                        </div>
                        
                        {/* Progress Legend */}
                        <div className="flex items-center justify-between mt-2 text-[10.5px] font-semibold text-gray-700">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-2.5 h-2.5 rounded-sm ${requirementMet ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                    <span>Done: {doneC}</span>
                                </div>
                                {showRegistered && (
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                                        <span>Reg: {actualRegC}</span>
                                    </div>
                                )}
                                {remainingCourses > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-sm bg-gray-300" />
                                        <span>Left: {remainingCourses}</span>
                                    </div>
                                )}
                            </div>
                            <span className="font-bold">{reqC} total</span>
                        </div>
                    </div>
                    
                    {/* Stats Cards - Compact */}
                    <div className="flex-1 flex flex-col">
                        <div className="flex items-stretch gap-2.5 mb-2.5">
                            {/* Courses Card */}
                            <motion.div 
                                className="flex-1 bg-white rounded-lg px-3 py-3 border-2 border-gray-200 flex flex-col"
                                whileHover={{ borderColor: 'rgb(229 231 235)', scale: 1.01 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="text-gray-500 text-[10px] font-bold mb-2 uppercase tracking-wider">Courses</div>
                                <div className="flex-1 flex flex-col items-center justify-center">
                                    <div className="font-bold text-gray-900 text-lg">{doneC} / {reqC}</div>
                                    <div className="text-gray-400 text-[9px] font-medium h-[14px] mt-0.5">
                                        {showRegistered && `+${actualRegC} registered`}
                                    </div>
                                </div>
                            </motion.div>
                            
                            {/* Credits Card */}
                            <motion.div 
                                className="flex-1 bg-white rounded-lg px-3 py-3 border-2 border-gray-200 flex flex-col"
                                whileHover={{ borderColor: 'rgb(229 231 235)', scale: 1.01 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="text-gray-500 text-[10px] font-bold mb-2 uppercase tracking-wider">Credits</div>
                                <div className="flex-1 flex flex-col items-center justify-center">
                                    <div className="font-bold text-gray-900 text-lg">{doneCr} / {reqCr}</div>
                                    <div className="text-gray-400 text-[9px] font-medium h-[14px] mt-0.5">
                                        {showRegistered && `+${actualRegCr} registered`}
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                        
                        {/* Status Info - Compact */}
                        {remainingCourses > 0 ? (
                            <motion.div 
                                className="bg-white rounded-lg px-3 py-2 border-2 border-gray-200 text-center"
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <div className="text-[11px] text-gray-600 font-semibold">
                                    <span className="font-bold text-gray-900">{remainingCourses}</span> courses • <span className="font-bold text-gray-900">{remainingCredits}</span> credits left
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div 
                                className="bg-white rounded-lg px-3 py-2 border-2 border-red-500 text-center"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 }}
                            >
                                <div className="text-[11px] font-bold text-red-600">
                                    ✓ All Requirements Completed
                                </div>
                            </motion.div>
                        )}
                    </div>
                    
                    {/* Footer - View Details */}
                    <motion.div 
                        className="pt-3 pb-0.5 text-center border-t border-gray-100 mt-auto"
                    >
                        <div className="text-[11px] font-semibold text-gray-500 group-hover:text-red-600 transition-colors flex items-center justify-center gap-1">
                            <span>View Details</span>
                            <motion.span
                                animate={{ x: isHovered ? 3 : 0 }}
                                transition={{ duration: 0.2 }}
                                className="text-xs"
                            >
                                →
                            </motion.span>
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </Link>
    );
};

export default CategoryCard;