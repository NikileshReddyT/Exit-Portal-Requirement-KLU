import React from 'react';
import { motion } from 'framer-motion';
import CategoryCard from './CategoryCard';
import { FiInbox } from 'react-icons/fi';

const CategoryList = ({ categories, onShowPopup }) => {
    if (!categories || categories.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20 px-6 bg-white rounded-2xl border border-dashed border-gray-300"
            >
                <FiInbox className="mx-auto text-gray-400" size={48} />
                <h3 className="mt-4 text-xl font-semibold text-brand-charcoal">No Categories Found</h3>
                <p className="mt-2 text-gray-500">Your search did not return any results. Try a different query.</p>
            </motion.div>
        );
    }

    const sortedCategories = [...categories].sort((a, b) => {
        // Calculate status for each category: 1=At Risk, 2=On Track, 3=Complete
        const getStatusOrder = (cat) => {
            const reqC = Number(cat.minRequiredCourses) || 0;
            const regC = Number(cat.registeredCourses) || 0;
            const doneC = Number(cat.completedCourses) || 0;
            const reqCr = Number(cat.minRequiredCredits) || 0;
            const regCr = Number(cat.registeredCredits) || 0;
            const doneCr = Number(cat.completedCredits) || 0;
            
            // Actual registered = registered - completed (pending registrations only)
            const actualRegC = Math.max(0, regC - doneC);
            const actualRegCr = Math.max(0, regCr - doneCr);
            
            const requirementMet = (doneC >= reqC) && (doneCr >= reqCr);
            const onTrack = !requirementMet && (doneC + actualRegC) >= reqC && (doneCr + actualRegCr) >= reqCr;
            
            return requirementMet ? 3 : onTrack ? 2 : 1;
        };
        
        return getStatusOrder(a) - getStatusOrder(b); // Sort: At Risk → On Track → Complete
    });

    const containerVariants = {
        hidden: { opacity: 1 },
        visible: { transition: { staggerChildren: 0.05 } },
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
        >
            {sortedCategories.map((category, index) => (
                <CategoryCard key={category.categoryName} category={category} onShowPopup={onShowPopup} index={index} />
            ))}
        </motion.div>
    );
};


export default CategoryList;