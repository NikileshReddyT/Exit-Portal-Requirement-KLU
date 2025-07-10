import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLock, FiCheckCircle, FiXCircle, FiArrowLeft } from 'react-icons/fi';
import config from '../config';

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const token = new URLSearchParams(location.search).get('token');

    useEffect(() => {
        if (!token) {
            setError('Invalid or missing password reset token.');
        }
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        setError('');
        setMessage('');
        setLoading(true);

        try {
            await axios.post(`${config.backendUrl}/api/v1/password/reset`, { token, newPassword: password });
            setMessage('Your password has been reset successfully! You can now log in with your new password.');
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setError('Failed to reset password. The link may be expired or invalid.');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center font-sans">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-xl"
            >
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-gray-800">Reset Your Password</h2>
                    <p className="mt-2 text-gray-600">Choose a new, secure password.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="relative">
                        <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red focus:border-transparent transition-all duration-300 outline-none"
                            placeholder="Enter new password"
                            required
                        />
                    </div>
                    <div className="relative">
                        <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red focus:border-transparent transition-all duration-300 outline-none"
                            placeholder="Confirm new password"
                            required
                        />
                    </div>

                    <AnimatePresence>
                        {message && (
                            <motion.p
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="text-green-600 text-sm text-center p-3 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2"
                            >
                                <FiCheckCircle /> {message}
                            </motion.p>
                        )}
                        {error && (
                            <motion.p
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="text-red-600 text-sm text-center p-3 bg-red-50 rounded-lg border border-red-200 flex items-center gap-2"
                            >
                                <FiXCircle /> {error}
                            </motion.p>
                        )}
                    </AnimatePresence>

                    <button
                        type="submit"
                        disabled={loading || !token}
                        className="w-full group flex items-center justify-center gap-2 bg-brand-red text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-300 transition-all duration-300 transform hover:-translate-y-1 disabled:bg-red-400 disabled:cursor-not-allowed disabled:transform-none shadow-lg hover:shadow-red-500/40"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Resetting...</span>
                            </>
                        ) : (
                            <span>Reset Password</span>
                        )}
                    </button>
                </form>
                <div className="text-center mt-4">
                    <Link to="/login" className="text-sm text-brand-red hover:underline font-medium flex items-center justify-center gap-2">
                        <FiArrowLeft />
                        Back to Login
                    </Link>
                </div>
            </motion.div>
        </div>
    );
};

export default ResetPassword;
