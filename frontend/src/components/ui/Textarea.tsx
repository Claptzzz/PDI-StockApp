import { useId, type TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

/** Textarea del theme UCN. `w-full` + `resize-y` para que no desborde en móvil. */
export function Textarea({ label, error, className = '', id, ...props }: TextareaProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {label && (
        <label htmlFor={textareaId} className="text-sm font-semibold text-text-secondary">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={2}
        className={`w-full resize-y rounded-[var(--radius)] border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-primary ${
          error ? 'border-danger' : 'border-border'
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
