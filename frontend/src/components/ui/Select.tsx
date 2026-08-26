import { useId, type SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  /** Pinta el borde en rojo. Va como prop y no por className porque el color de
   *  borde base está en la clase del componente y no se puede sobrescribir de forma
   *  fiable desde fuera (misma especificidad, gana el orden del CSS generado). */
  invalid?: boolean;
}

export function Select({
  label,
  invalid = false,
  className = '',
  id,
  children,
  ...props
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-semibold text-text-secondary">
          {label}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={invalid || undefined}
        className={`min-h-[44px] rounded-[var(--radius)] border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-primary ${
          invalid ? 'border-danger' : 'border-border'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
