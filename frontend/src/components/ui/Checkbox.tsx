import type { InputHTMLAttributes, ReactNode } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode;
  /** Texto auxiliar bajo la etiqueta. */
  hint?: ReactNode;
}

/**
 * Checkbox con área táctil ≥44px: el <label> envuelve todo, así el toque en
 * cualquier parte de la fila alterna el valor (requisito móvil).
 */
export function Checkbox({ label, hint, className = '', disabled, ...props }: CheckboxProps) {
  return (
    <label
      className={`flex min-h-[44px] cursor-pointer items-start gap-3 py-1 ${
        disabled ? 'cursor-not-allowed opacity-60' : ''
      } ${className}`}
    >
      <input
        type="checkbox"
        disabled={disabled}
        className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer rounded border-border accent-[var(--color-primary)] disabled:cursor-not-allowed"
        {...props}
      />
      {(label || hint) && (
        <span className="min-w-0 flex-1 self-center">
          {label && <span className="block text-sm text-text-primary">{label}</span>}
          {hint && <span className="mt-0.5 block text-xs text-text-secondary">{hint}</span>}
        </span>
      )}
    </label>
  );
}
