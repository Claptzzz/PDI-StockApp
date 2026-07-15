import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface-card">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ className = '', children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`bg-gray-50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ className = '', children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`border-t border-border px-4 py-2.5 text-text-primary ${className}`} {...props}>
      {children}
    </td>
  );
}
