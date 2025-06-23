import React from 'react';
import { clsx } from 'clsx';

interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

const Separator: React.FC<SeparatorProps> = ({
  orientation = 'horizontal',
  className,
}) => {
  return (
    <div
      className={clsx(
        'bg-gray-200',
        {
          'h-px w-full': orientation === 'horizontal',
          'w-px h-full': orientation === 'vertical',
        },
        className
      )}
    />
  );
};

export { Separator }; 