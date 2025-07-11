import React from 'react';

import { NavbarSkeleton } from './NavbarSkeleton';

export const DashboardSkeleton = () => (
    <div className="animate-pulse">
        <NavbarSkeleton />
        
        {/* Welcome Header */}
        <div className="px-4 sm:px-6 lg:px-8 pt-8 pb-4">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-3"></div>
            <div className="h-5 bg-gray-200 rounded w-1/2"></div>
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-xl shadow-lg p-6 m-4 sm:m-6 lg:m-8">
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Left Side: Progress Circle */}
                <div className="flex-shrink-0 w-full lg:w-1/3 flex items-center justify-center p-4">
                    <div className="w-48 h-48 bg-gray-200 rounded-full"></div>
                </div>

                {/* Right Side: Summary Cards */}
                <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-gray-100 rounded-xl p-5 flex items-center shadow-sm">
                            <div className="w-14 h-14 bg-gray-300 rounded-full mr-5"></div>
                            <div className="flex-grow">
                                <div className="h-5 bg-gray-300 rounded w-3/4 mb-2"></div>
                                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Requirement Categories Section */}
        <div className="px-4 sm:px-6 lg:px-8 mt-8">
            <div className="flex justify-between items-center mb-4">
                <div className="h-7 bg-gray-200 rounded w-1/4"></div>
                <div className="h-5 bg-gray-200 rounded w-24"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                            <div className="h-5 bg-gray-200 rounded w-1/4"></div>
                        </div>
                        <div className="flex justify-between mb-4">
                            <div>
                                <div className="h-4 bg-gray-200 rounded w-16 mb-1"></div>
                                <div className="h-5 bg-gray-200 rounded w-12"></div>
                            </div>
                            <div>
                                <div className="h-4 bg-gray-200 rounded w-16 mb-1"></div>
                                <div className="h-5 bg-gray-200 rounded w-12"></div>
                            </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);
