import { useId, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Mensaje de error: pinta el borde en rojo y lo muestra debajo. */
  error?: string;
  /** Solo pinta el borde en rojo, sin mensaje (p. ej. una fila de una lista). */
  invalid?: boolean;
}

export function Input({ label, error, invalid = false, className = '', id, ...props }: InputProps) {
  const isInvalid = invalid || Boolean(error);
  // Sin id explícito el `htmlFor` quedaba en undefined y la etiqueta no asociaba
  // (no era clicable ni la leían los lectores de pantalla).
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-text-secondary">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={isInvalid || undefined}
        className={`min-h-[44px] rounded-[var(--radius)] border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-primary ${
          isInvalid ? 'border-danger' : 'border-border'
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
