import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence, scale } from 'framer-motion';
import { FiUser, FiLock, FiLogIn, FiLoader, FiAlertTriangle, FiArrowRight } from 'react-icons/fi';
import config from '../config';
import bg from '../images/home.png'

const Login = () => {
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.post(`${config.backendUrl}/api/v1/frontend/login`, {
                universityId: id,
                password: password
            });

            if (response.data && response.data.universityid) {
                localStorage.clear();
                localStorage.setItem('studentId', response.data.universityid);
                navigate('/dashboard');
            } else {
                setError('Unexpected response from server.');
            }
        } catch (err) {
            if (err.response) {
                if (err.response.status === 401) {
                    setError('Incorrect password. Please try again.');
                } else if (err.response.status === 404) {
                    setError('User not found. Please check your ID.');
                } else {
                    setError('An unexpected error occurred. Please try again later.');
                }
            } else {
                setError('Network error. Please check your connection.');
            }
        } finally {
            setLoading(false);
        }
    };

    const containerVariants = {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.5, ease: 'easeOut' } },
    };

    const formVariants = {
        initial: { opacity: 0, y: 30 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.6, -0.05, 0.01, 0.99] } },
    };

    const leftPanelVariants = {
        initial: { opacity: 0 , width: '100%'},
        animate: {  opacity: 1, width: '100%', transition: { duration: 0.8, ease: [0.6, -0.05, 0.01, 0.99], delay: 0.2 } },
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="initial"
            animate="animate"
            className="min-h-screen font-sans bg-gray-100 flex"
        >
            {/* Left Panel */}
            <motion.div
                variants={leftPanelVariants}
                className="hidden lg:flex lg:w-1/2 bg-brand-charcoal p-12 flex-col justify-between relative overflow-hidden z-10"
                style={{
                    backgroundImage: `url(${bg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    
                }}
            >
                <span className="absolute top-0 left-0 w-full h-full bg-black opacity-50 backdrop-blur-sm z-0"></span>
                <div className="absolute -top-20 -right-20 w-72 h-72 bg-brand-red-light rounded-full"></div>
                <div className="absolute -bottom-24 -left-16 w-80 h-80 bg-brand-red-light rounded-full"></div>
                
                <div className="z-10">
                    <Link to="/"><h1 className="text-4xl font-bold text-white tracking-wider text-center hover:text-red-700 transition-all duration-300">KL University</h1></Link>
                </div>
                <div className="z-10 text-center">
                    <h2 className="text-5xl font-bold text-white leading-tight">Unlock Your<br/>Academic Journey.</h2>
                    <p className="text-gray-300 mt-4">Track progress, verify eligibility, and generate reports—all in one seamless portal.</p>
                </div>
                <div className="z-10 text-center">
                    <p className="text-gray-400 text-sm">&copy; {new Date().getFullYear()} Exit Requirement Portal. All Rights Reserved.</p>
                    <p className="text-gray-400 text-sm">Developed by <span className="font-bold ">Nikilesh Reddy T @ CSE-R</span></p>
                </div>
            </motion.div>

            {/* Right Panel - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8">
                <motion.div 
                    variants={formVariants}
                    className="w-full max-w-md h-full lg:h-auto"
                >
                    <div className="text-center lg:hidden mb-10">
                        <Link to="/"><h1 className="text-2xl sm:text-3xl font-black text-brand-charcoal tracking-wider">Exit Requirement Portal</h1></Link>
                        <p className="text-gray-500 mt-2">Unlock Your Academic Journey.</p>
                    </div>

                    {/* Glassmorphism Card for Mobile, Seamless for Desktop */}
                    <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/30 lg:bg-transparent lg:backdrop-blur-none lg:shadow-none lg:p-0 lg:border-none">
                        <motion.h2 variants={formVariants} className="text-xl font-bold text-brand-charcoal text-center  lg:text-3xl mb-2">Sign In</motion.h2>
                        <motion.p variants={formVariants} className="text-gray-600 text-center  lg:text-base mb-10">Enter your credentials to access your account.</motion.p>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <motion.div variants={formVariants}>
                                <label className="block text-gray-700 text-sm lg:text-base font-bold mb-2" htmlFor="university-id">
                                    University ID
                                </label>
                                <div className="relative">
                                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        id="university-id"
                                        type="text"
                                        value={id}
                                        onChange={(e) => setId(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-white/50 border-2 border-white/40 rounded-xl focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red transition-all duration-300 outline-none placeholder-gray-500 text-brand-charcoal shadow-inner"
                                        placeholder="e.g., 2200039163"
                                        required
                                    />
                                </div>
                            </motion.div>

                            <motion.div variants={formVariants}>
                                <label className="block text-gray-700 text-sm lg:text-base font-bold mb-2" htmlFor="password">
                                    Password
                                </label>
                                <div className="relative">
                                    <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-white/50 border-2 border-white/40 rounded-xl focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red transition-all duration-300 outline-none placeholder-gray-500 text-brand-charcoal shadow-inner"
                                        placeholder="Enter your password"
                                        required
                                    />
                                </div>
                                <div className="text-right mt-2">
                                    <Link to="/forgot-password" className="text-sm text-brand-red hover:underline font-semibold">
                                        Forgot Password?
                                    </Link>
                                </div>
                            </motion.div>

                            <AnimatePresence>
                                {error && (
                                    <motion.p 
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="text-red-800 text-sm font-semibold text-center p-3 bg-red-100 rounded-lg border border-red-200 shadow-md"
                                    >
                                        {error}
                                    </motion.p>
                                )}
                            </AnimatePresence>

                            <motion.div variants={formVariants}>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full group flex items-center justify-center gap-3 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold py-3.5 px-4 rounded-xl hover:from-red-700 hover:to-red-900 focus:outline-none focus:ring-4 focus:ring-red-300 transition-all duration-300 transform hover:-translate-y-1 disabled:from-red-400 disabled:to-red-500 disabled:cursor-not-allowed disabled:transform-none shadow-2xl hover:shadow-red-500/50"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Signing In...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Sign In</span>
                                            <FiArrowRight className="transition-transform duration-300 group-hover:translate-x-1.5" />
                                        </>
                                    )}
                                </button>
                            </motion.div>
                        </form>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default Login;
