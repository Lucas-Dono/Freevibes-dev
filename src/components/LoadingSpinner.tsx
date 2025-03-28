import React from 'react';

interface LoadingSpinnerProps {
  size?: number;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 40 }) => {
  return (
    <div className="flex justify-center items-center">
      <div 
        className="animate-spin rounded-full border-t-2 border-b-2 border-green-500" 
        style={{ width: `${size}px`, height: `${size}px` }}
      ></div>
    </div>
  );
};

export default LoadingSpinner; 