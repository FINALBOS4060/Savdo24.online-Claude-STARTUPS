import React from 'react';

interface LoadingStateProps {
  variant?: 'inline' | 'block';
  text?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  variant = 'inline',
  text = 'Yuklanmoqda...',
  className = ''
}) => {
  if (variant === 'inline') {
    return (
      <div className={`inline-flex items-center gap-2 text-xs font-semibold text-on-primary-container ${className}`}>
        <div className="w-4 h-4 border-2 border-secondary-container border-t-transparent rounded-full animate-spin" />
        <span>{text}</span>
      </div>
    );
  }

  return (
    <div className={`w-full py-12 px-6 flex flex-col items-center justify-center gap-3 bg-surface-container/50 border border-outline/20 rounded-2xl animate-pulse ${className}`}>
      <div className="w-8 h-8 border-3 border-secondary-container border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-semibold text-on-primary-container">{text}</p>
    </div>
  );
};
