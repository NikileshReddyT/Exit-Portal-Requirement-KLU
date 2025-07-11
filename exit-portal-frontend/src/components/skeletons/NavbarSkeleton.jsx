import React from 'react';

export const NavbarSkeleton = () => (
  <nav className="bg-white shadow-sm py-4 px-6">
    <div className="max-w-8xl mx-auto px-4 sm:px-2 flex  justify-between items-center">
      {/* Student Info Skeleton */}
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
        <div>
          <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
      
      {/* Logo Skeleton */}
      <div className="flex-1 flex justify-center">
        <div className="w-40 h-10 bg-gray-200 rounded-lg"></div>
      </div>
      
      {/* Logout Button Skeleton */}
      <div className="w-24 h-10 bg-gray-200 rounded-lg"></div>
    </div>
  </nav>
);
