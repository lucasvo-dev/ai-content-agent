import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

interface SelectContextType {
  value?: string;
  onValueChange?: (value: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  disabled?: boolean;
  items?: Map<string, string>; // value -> display text mapping
  setItems?: (items: Map<string, string>) => void;
}

const SelectContext = React.createContext<SelectContextType | null>(null);

const Select: React.FC<SelectProps> = ({
  value,
  onValueChange,
  children,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<Map<string, string>>(new Map());

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange,
        isOpen,
        setIsOpen,
        disabled,
        items,
        setItems,
      }}
    >
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
};

interface SelectTriggerProps {
  children: React.ReactNode;
  className?: string;
}

const SelectTrigger: React.FC<SelectTriggerProps> = ({
  children,
  className,
}) => {
  const context = React.useContext(SelectContext);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        context?.setIsOpen(false);
      }
    };

    if (context?.isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [context?.isOpen]);

  if (!context) return null;

  return (
    <button
      ref={ref}
      type="button"
      className={clsx(
        'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      onClick={() => !context.disabled && context.setIsOpen(!context.isOpen)}
      disabled={context.disabled}
    >
      {children}
      <svg
        className={clsx(
          'h-4 w-4 opacity-50 transition-transform',
          context.isOpen && 'rotate-180'
        )}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
};

interface SelectValueProps {
  placeholder?: string;
  className?: string;
  children?: React.ReactNode;
}

const SelectValue: React.FC<SelectValueProps> = ({ placeholder, className, children }) => {
  const context = React.useContext(SelectContext);
  
  if (!context) return null;

  // If children are provided, use them (custom display)
  if (children) {
    return (
      <span className={clsx(
        context.value ? 'text-gray-900' : 'text-gray-500',
        className
      )}>
        {children}
      </span>
    );
  }

  // Get display text from items map or fallback to value
  const displayText = context.value 
    ? (context.items?.get(context.value) || context.value)
    : (placeholder || 'Select an option');

  console.log('🔧 SelectValue render:', { 
    value: context.value, 
    displayText, 
    items: Array.from(context.items?.entries() || [])
  });

  return (
    <span className={clsx(
      context.value ? 'text-gray-900' : 'text-gray-500',
      className
    )}>
      {displayText}
    </span>
  );
};

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

const SelectContent: React.FC<SelectContentProps> = ({
  children,
  className,
}) => {
  const context = React.useContext(SelectContext);

  if (!context || !context.isOpen) return null;

  return (
    <div
      className={clsx(
        'absolute top-full left-0 z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg',
        'max-h-60 overflow-auto',
        className
      )}
    >
      {children}
    </div>
  );
};

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const SelectItem: React.FC<SelectItemProps> = ({
  value,
  children,
  className,
}) => {
  const context = React.useContext(SelectContext);

  if (!context) return null;

  // Register this item in the context
  React.useEffect(() => {
    if (context.setItems) {
      const displayText = typeof children === 'string' ? children : children?.toString() || value;
      context.setItems(prev => {
        const newMap = new Map(prev);
        newMap.set(value, displayText);
        return newMap;
      });
    }
  }, [value, children, context.setItems]);

  const isSelected = context.value === value;

  const handleClick = () => {
    console.log('🔧 SelectItem clicked:', { value, currentValue: context.value });
    if (context.onValueChange) {
      context.onValueChange(value);
      console.log('✅ onValueChange called with:', value);
    } else {
      console.log('❌ onValueChange not available');
    }
    context.setIsOpen(false);
  };

  return (
    <div
      className={clsx(
        'relative flex cursor-pointer select-none items-center py-2 px-3 text-sm',
        'hover:bg-gray-100',
        isSelected && 'bg-blue-50 text-blue-600',
        className
      )}
      onClick={handleClick}
    >
      {children}
      {isSelected && (
        <svg
          className="absolute right-3 h-4 w-4"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </div>
  );
};

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }; 