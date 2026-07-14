import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className = '', id, children, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-semibold text-text-secondary">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`rounded-[var(--radius)] border border-border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-primary ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
