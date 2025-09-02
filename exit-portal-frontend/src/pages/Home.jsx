import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiBarChart2, FiCheckSquare, FiDownload, FiBookOpen, FiLogIn, FiUserCheck, FiThumbsUp, FiZap, FiSmartphone, FiShield, FiChevronDown } from 'react-icons/fi';
import bg from '../images/bg.jpg';

const FeatureCard = ({ icon, title, children, delay }) => (
    <motion.div
        className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 transform hover:-translate-y-2 transition-transform duration-300 h-full flex flex-col items-center justify-center "
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, delay, ease: 'easeOut' }}
    >
        <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
            {React.cloneElement(icon, { className: "text-red-600", size: 32 })}
        </div>
        <h3 className="text-2xl font-bold text-brand-charcoal mb-3">{title}</h3>
        <p className="text-gray-600 text-center leading-relaxed">{children}</p>
    </motion.div>
);

const StepCard = ({ icon, title, children, delay }) => (
    <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, delay, ease: 'easeOut' }}
        className="text-center"
    >
        <div className="flex items-center justify-center w-24 h-24 bg-red-600 text-white rounded-full mx-auto mb-6 shadow-lg">
            {React.cloneElement(icon, { size: 40 })}
        </div>
        <h3 className="text-2xl font-bold text-brand-charcoal mb-2">{title}</h3>
        <p className="text-gray-600 px-4">{children}</p>
    </motion.div>
);



const Home = () => {
    const [showScrollIndicator, setShowScrollIndicator] = useState(true);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 50) {
                setShowScrollIndicator(false);
            } else {
                setShowScrollIndicator(true);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    return (
        <div className="font-sans bg-gray-50 text-gray-800">
            <div 
                className="fixed inset-0 z-10 h-screen w-screen"
                style={{
                    backgroundImage: `url(${bg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundAttachment: 'fixed',
                }}
            >
                <div className="absolute inset-0 bg-black opacity-60 h-full"></div>
            </div>

            <div className="relative z-10 overflow-x-hidden">
                {/* Hero Section */}
                <header className="min-h-screen flex flex-col items-center justify-center text-center p-6 relative h-[80vh]">
                    {/* Main Content */}
                    <motion.div
                        className="flex flex-col items-center justify-center"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                    >
                        <motion.p 
                            className="font-semibold text-red-500 text-lg mb-2"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
                        >
                            KL University
                        </motion.p>
                        <motion.h1 
                            className="text-5xl md:text-7xl font-extrabold text-white leading-tight tracking-tighter mb-6"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
                        >
                            Exit Requirement Portal
                        </motion.h1>
                        <motion.p 
                            className="max-w-3xl mx-auto text-lg md:text-xl text-gray-200 mb-10"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.7, delay: 0.4, ease: 'easeOut' }}
                        >
                            Your official gateway to a seamless graduation. Track progress, verify eligibility, and generate reports—all in one place.
                        </motion.p>
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.7, delay: 0.6, ease: 'easeOut' }}
                        >
                            <Link to="/login">
                                <button className="bg-red-600 text-white font-bold text-lg py-4 px-8 rounded-full shadow-lg hover:bg-red-700 transform hover:scale-105 transition-all duration-300 ease-in-out flex items-center gap-2 mx-auto">
                                    Login <FiArrowRight />
                                </button>
                            </Link>
                        </motion.div>
                    </motion.div>

                    {/* Scroll Down Indicator */}
                    <AnimatePresence>
                        {showScrollIndicator && (
                            <motion.div
                                className="absolute bottom-10 left-1/2 -translate-x-1/2"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                            >
                                <motion.div
                                    animate={{ y: [0, 10, 0] }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                    className="flex flex-col items-center gap-2"
                                >
                                    <span className="text-white text-xs md:text-sm opacity-90 tracking-widest uppercase">Scroll</span>
                                    <FiChevronDown className="text-white text-2xl md:text-3xl opacity-90" />
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </header>

            {/* Features Section */}
            <section className="py-20 md:py-32 bg-gray-50">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-extrabold text-brand-charcoal">Everything You Need for Graduation</h2>
                        <p className="text-lg text-gray-600 mt-4 max-w-3xl mx-auto">Our portal is designed to give you complete clarity on your academic standing and requirements.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                        <FeatureCard icon={<FiBarChart2 />} title="Progress Tracking" delay={0.1}>
                            Visualize your entire academic progress with an intuitive dashboard and a detailed completion percentage.
                        </FeatureCard>
                        <FeatureCard icon={<FiCheckSquare />} title="Eligibility Checks" delay={0.2}>
                            Instantly verify your eligibility for certificates and specializations without any manual calculations.
                        </FeatureCard>
                        <FeatureCard icon={<FiBookOpen />} title="Course Catalog" delay={0.3}>
                            Explore detailed category requirements and see available courses you can take to fulfill them.
                        </FeatureCard>
                        <FeatureCard icon={<FiDownload />} title="PDF Reports" delay={0.4}>
                            Generate and download official academic reports with a single click, ready for your records or advisors.
                        </FeatureCard>
                        <FeatureCard icon={<FiSmartphone />} title="Mobile-First Design" delay={0.5}>
                            Access the portal anytime, anywhere. Our responsive design works flawlessly on all your devices.
                        </FeatureCard>
                        <FeatureCard icon={<FiShield />} title="Secure & Reliable" delay={0.6}>
                            Your data is protected with industry-standard security, ensuring your information is always safe.
                        </FeatureCard>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className="py-20 md:py-32 bg-white">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-4xl md:text-5xl font-extrabold text-brand-charcoal mb-16">Get Started in 3 Simple Steps</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 relative">
                        <StepCard icon={<FiLogIn />} title="Login Securely" delay={0.2}>
                            Use your university credentials to access your personalized dashboard.
                        </StepCard>
                        <StepCard icon={<FiUserCheck />} title="View Your Dashboard" delay={0.4}>
                            See your progress, check category fulfillment, and view your stats instantly.
                        </StepCard>
                        <StepCard icon={<FiZap />} title="Track to Graduation" delay={0.6}>
                            Stay on top of your requirements and move confidently towards graduation day.
                        </StepCard>
                    </div>
                </div>
            </section>



            {/* Final CTA Section */}
            <section className="bg-white py-20 md:py-24">
                <div className="container mx-auto px-6 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.5 }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                    >
                        <h2 className="text-4xl md:text-5xl font-extrabold text-brand-charcoal">Ready to Take Control of Your Academic Journey?</h2>
                        <p className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto mb-10">Log in now to see your personalized dashboard and take the next step towards graduation.</p>
                        <Link to="/login">
                            <button className="bg-red-600 text-white font-bold text-lg py-4 px-8 rounded-full shadow-lg hover:bg-red-700 transform hover:scale-105 transition-all duration-300 ease-in-out flex items-center gap-2 mx-auto">
                                Access Your Dashboard <FiArrowRight />
                            </button>
                        </Link>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-black/60 text-white py-12">
                <div className="container mx-auto px-6 text-center">
                    <p className="font-bold text-lg">KL University Exit Requirement Portal</p>
                    <p className="text-sm text-gray-400 mt-2">&copy; {new Date().getFullYear()} All Rights Reserved. Developed with ❤️ for the students by students.</p>
                </div>
            </footer>
            </div>
        </div>
    );
};

export default Home;
