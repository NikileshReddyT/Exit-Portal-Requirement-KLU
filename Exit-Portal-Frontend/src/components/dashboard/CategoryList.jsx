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
        const aIncomplete = a.completedCourses < a.minRequiredCourses;
        const bIncomplete = b.completedCourses < b.minRequiredCourses;
        if (aIncomplete === bIncomplete) return 0;
        return aIncomplete ? -1 : 1;
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