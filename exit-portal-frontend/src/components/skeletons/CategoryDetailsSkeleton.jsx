import React from 'react';
import { NavbarSkeleton } from './NavbarSkeleton';

export const CategoryDetailsSkeleton = () => (
  <div className="min-h-screen bg-gray-50 font-sans animate-pulse">
    <NavbarSkeleton />

    <main className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Back button */}
        <div className="mb-6">
          <div className="h-10 w-40 bg-gray-200 rounded-lg"></div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 mb-8 animate-pulse">
  <div className="flex items-center justify-between">
    {/* Left side: Text lines */}
    <div className="flex flex-col space-y-2">
      <div className="h-4 bg-gray-300 rounded w-24"></div> {/* Progress label */}
      <div className="h-6 bg-gray-300 rounded w-48"></div> {/* 9 / 10 Courses */}
      <div className="h-4 bg-gray-300 rounded w-64"></div> {/* "You need to complete..." */}
    </div>

    {/* Right side: Progress bar */}
    <div className="flex flex-col items-end w-1/3 space-y-2">
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div className="bg-gray-300 h-3 rounded-full w-[90%]"></div>
      </div>
    </div>
  </div>
</div>



        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Side: Completed Courses */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <div className="h-6 bg-gray-300 rounded w-1/4 mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="bg-white p-5 rounded-lg shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <div className="h-5 bg-gray-300 rounded w-3/5"></div>
                      <div className="h-5 bg-gray-300 rounded w-1/5"></div>
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-2/5"></div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="h-6 bg-gray-300 rounded w-1/4 mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white p-5 rounded-lg shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <div className="h-5 bg-gray-300 rounded w-3/5"></div>
                      <div className="h-5 bg-gray-300 rounded w-1/5"></div>
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-2/5"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side: Available Courses */}
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="h-7 bg-gray-300 rounded w-1/2 mb-6"></div>
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-2 border-b border-gray-100 last:border-b-0">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg flex-shrink-0"></div>
                  <div className="flex-grow">
                    <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
);
