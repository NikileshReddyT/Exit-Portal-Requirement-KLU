import React from 'react';

const StatCard = ({ 
  title, 
  value, 
  subtitle, 
  trend, 
  trendValue, 
  icon, 
  color = 'blue',
  onClick,
  loading = false 
}) => {
  const colorClasses = {
    blue: 'from-blue-50 to-blue-100 text-blue-700 border-blue-200',
    green: 'from-green-50 to-green-100 text-green-700 border-green-200',
    yellow: 'from-yellow-50 to-yellow-100 text-yellow-700 border-yellow-200',
    red: 'from-red-50 to-red-100 text-red-700 border-red-200',
    purple: 'from-purple-50 to-purple-100 text-purple-700 border-purple-200',
    gray: 'from-gray-50 to-gray-100 text-gray-700 border-gray-200',
  };

  const Component = onClick ? 'button' : 'div';
  const baseClasses = "bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 w-full transition-all duration-200";
  const interactiveClasses = onClick ? "hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer" : "";

  if (loading) {
    return (
      <div className={`${baseClasses} animate-pulse`}>
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-20"></div>
            <div className="h-8 bg-gray-200 rounded w-16"></div>
            <div className="h-3 bg-gray-200 rounded w-24"></div>
          </div>
          <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <Component 
      className={`${baseClasses} ${interactiveClasses} text-left`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-600 uppercase tracking-wide">
            {title}
          </p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mt-1 truncate">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">
              {subtitle}
            </p>
          )}
          {trend && trendValue && (
            <div className="flex items-center mt-2">
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                trend === 'up' ? 'bg-green-50 text-green-700 border border-green-200' :
                trend === 'down' ? 'bg-red-50 text-red-700 border border-red-200' :
                'bg-gray-50 text-gray-700 border border-gray-200'
              }`}>
                <span className="text-xs">
                  {trend === 'up' ? '↗️' : trend === 'down' ? '↘️' : '➡️'}
                </span>
                {trendValue}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br border flex items-center justify-center flex-shrink-0 ml-3 ${colorClasses[color] || colorClasses.blue}`}>
            <span className="text-lg sm:text-xl">{icon}</span>
          </div>
        )}
      </div>
    </Component>
  );
};

export default StatCard;
