import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiLogOut, FiMenu, FiX, FiGrid } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = ({ student }) => {
    const navigate = useNavigate();
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        localStorage.clear();
        navigate('/');
    };

    const getInitials = (name) => {
        if (!name) return '...';
        const names = name.split(' ');
        return names.map(n => n[0]).join('').toUpperCase();
    };

    const menuVariants = {
        closed: { opacity: 0, height: 0 },
        open: { opacity: 1, height: 'auto', transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
    };

    const menuItemVariants = {
        closed: { opacity: 0, y: -15 },
        open: { opacity: 1, y: 0 },
    };

    return (
        <header className="bg-white/95 backdrop-blur-lg sticky top-0 z-50 border-b border-gray-200/80">
            <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    {/* Student Info */}
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full flex items-center justify-center text-white bg-red-900 font-bold border-2 border-white shadow-sm">
                            <span className="text-white text-sm">{getInitials(student?.name)}</span>
                        </div>
                        <div className="text-left">
                            <p className="font-semibold text-md text-gray-800">{student?.name}</p>
                            <p className="text-xs text-gray-500">{student?.universityId}</p>
                        </div>
                    </div>
                    
                    {/* Logo - Centered */}
                    <div className="absolute left-1/2 transform -translate-x-1/2 hidden md:block">
                        <Link to="/dashboard" className="text-2xl font-bold text-brand-charcoal hover:text-brand-red transition-colors">
                            Exit Requirement Portal
                        </Link>
                    </div>
                    
                    {/* Desktop Logout Button */}
                    <div className="hidden md:flex items-center">
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 rounded-full text-white bg-red-900 hover:bg-red-800 transition-all duration-300 group shadow-sm"
                            aria-label="Logout"
                        > 
                            <span>Logout</span>
                            <FiLogOut size={18} className="transition-transform group-hover:translate-x-1" />
                        </button>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden">
                        <button 
                            onClick={() => setMobileMenuOpen(!isMobileMenuOpen)} 
                            className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-brand-red hover:bg-gray-100 focus:outline-none"
                        >
                            <span className="sr-only">Open main menu</span>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={isMobileMenuOpen ? 'close' : 'open'}
                                    initial={{ rotate: -90, opacity: 0 }}
                                    animate={{ rotate: 0, opacity: 1 }}
                                    exit={{ rotate: 90, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {isMobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
                                </motion.div>
                            </AnimatePresence>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        variants={menuVariants}
                        initial="closed"
                        animate="open"
                        exit="closed"
                        className="md:hidden border-t border-gray-200/80"
                    >
                        <div className="pt-4 pb-3">
                            <motion.div variants={menuItemVariants} className="mt-3 px-2 space-y-1">
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium text-gray-600 hover:text-brand-red hover:bg-red-50 transition-colors"
                                >
                                    <FiLogOut />
                                    <span>Logout</span>
                                </button>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
};

export default Navbar;
