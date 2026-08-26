import type { InputHTMLAttributes } from 'react';

interface SearchBarProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value: string;
  onValueChange: (value: string) => void;
  /** Texto a la derecha (p. ej. "3 de 12 equipos"). */
  hint?: string;
}

/**
 * Barra de búsqueda del theme UCN. Ancho completo en móvil; el hint de resultados
 * baja a su propia línea para no comprimir el input.
 */
export function SearchBar({
  value,
  onValueChange,
  hint,
  placeholder,
  className = '',
  ...props
}: SearchBarProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center ${className}`}>
      <div className="relative min-w-0 flex-1">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        >
          ⌕
        </span>
        <input
          type="search"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={placeholder}
          // Se oculta la ✕ nativa de `type="search"` (Chrome/Safari) para no duplicarla
          // con el botón de limpiar propio, que sí respeta el theme.
          className="min-h-[44px] w-full rounded-[var(--radius)] border border-border bg-surface-card py-2 pl-8 pr-9 text-sm text-text-primary outline-none transition-colors focus:border-primary [&::-webkit-search-cancel-button]:appearance-none"
          {...props}
        />
        {value && (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => onValueChange('')}
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-text-muted transition-colors hover:bg-gray-100 hover:text-text-primary"
          >
            ✕
          </button>
        )}
      </div>
      {hint && (
        <span className="shrink-0 text-xs text-text-secondary sm:ml-3">{hint}</span>
      )}
    </div>
  );
}
