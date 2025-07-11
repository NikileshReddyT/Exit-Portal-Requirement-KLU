import React from 'react';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiStar, FiAward, FiGrid } from 'react-icons/fi';

const SummaryItem = ({ icon, label, value, status, colorClass }) => (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200/80">
        <div className={`p-3 rounded-full ${colorClass}`}>
            {React.cloneElement(icon, { className: "text-white", size: 20 })}
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="text-lg font-bold text-brand-charcoal">{value}</p>
            {status && <p className={`text-sm font-medium ${colorClass.replace('bg-', 'text-')}-600`}>{status}</p>}
        </div>
    </div>
);

export const ProgressCircle = ({ overallProgress }) => {
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (overallProgress / 100) * circumference;

    return (
        <div className="relative w-32 h-32 md:w-44 md:h-44">
            <svg className="w-full h-full" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="12" className="stroke-gray-200" />
                <motion.circle
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    strokeWidth="12"
                    className="stroke-red-900"
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                    style={{ strokeDasharray: circumference }}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1.5, ease: 'easeInOut', delay: 0.2 }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl md:text-4xl font-extrabold text-brand-charcoal">{`${overallProgress.toFixed(0)}%`}</p>
                <p className="text-sm md:text-base font-medium text-gray-500">Progress</p>
            </div>
        </div>
    );
};

export const SummaryCards = ({ summary }) => {
    if (!summary) return null;

    const { 
        isCertificateEligible, 
        isSpecializationCompleted,
        totalCategories,
        completedCategories,
        totalCompletedCredits,
        totalRequiredCredits
    } = summary;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <SummaryItem
                label="Certificate Status"
                value={isCertificateEligible ? "Eligible" : "Not Yet"}
                status={isCertificateEligible ? "Ready to claim!" : "Keep up the work!"}
                icon={<FiCheckCircle />}
                colorClass={isCertificateEligible ? "bg-green-600" : "bg-red-600"}
            />
            <SummaryItem
                label="Specialization"
                value={isSpecializationCompleted ? "Completed" : "In Progress"}
                status={isSpecializationCompleted ? "Track complete." : "Core courses pending."}
                icon={<FiStar />}
                colorClass={isSpecializationCompleted ? "bg-green-600" : "bg-red-600"}
            />
            <SummaryItem
                label="Categories Completed"
                value={`${completedCategories} / ${totalCategories}`}
                status={`${totalCategories - completedCategories} remaining`}
                icon={<FiGrid />}
                colorClass="bg-red-600"
            />
            <SummaryItem
                label="Credits Completed"
                value={`${totalCompletedCredits} / ${totalRequiredCredits}`}
                status={`${totalRequiredCredits - totalCompletedCredits} remaining`}
                icon={<FiAward />}
                colorClass="bg-red-600"
            />
        </div>
    );
};

const Summary = ({ summary }) => {
    if (!summary) {
        return null;
    }

    const { totalRequiredCredits, totalCompletedCredits } = summary;
    const overallProgress = totalRequiredCredits > 0 ? (totalCompletedCredits / totalRequiredCredits) * 100 : 0;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200/80"
        >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                <div className="flex justify-center items-center">
                    <ProgressCircle overallProgress={overallProgress} />
                </div>
                <div className="md:col-span-2">
                    <SummaryCards summary={summary} />
                </div>
            </div>
        </motion.div>
    );
};

export default Summary;
