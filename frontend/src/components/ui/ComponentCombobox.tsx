import { useEffect, useRef, useState } from 'react';
import { useComponents } from '@/api/components';
import { useDebounced } from '@/hooks/useDebounced';
import type { Component } from '@/lib/apiTypes';
import { TagBadgeList } from './TagBadge';

/** Mínimo de caracteres antes de consultar el catálogo. */
const MIN_CHARS = 2;

interface ComponentComboboxProps {
  value: string;
  label?: string;
  placeholder?: string;
  /** Cambio de texto libre (el padre debería limpiar el componentId seleccionado). */
  onChange: (text: string) => void;
  /** Se eligió una sugerencia (componente real de bodega). */
  onPick: (component: Component) => void;
}

/**
 * Autocompletado sobre GET /components?search= (busca por nombre O código).
 * El texto libre sigue siendo válido: si nada coincide, el padre puede usar el
 * texto tal cual y prestar sin componentId.
 */
export function ComponentCombobox({
  value,
  label,
  placeholder,
  onChange,
  onPick,
}: ComponentComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  const debounced = useDebounced(value.trim(), 300);
  const enoughChars = debounced.length >= MIN_CHARS;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const search = useComponents(enoughChars ? debounced : '');
  const suggestions = enoughChars ? (search.data ?? []) : [];
  const showDropdown = open && enoughChars;

  const pick = (c: Component) => {
    onPick(c);
    setOpen(false);
    setHighlight(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === 'Enter') {
      if (highlight >= 0 && suggestions[highlight]) {
        e.preventDefault();
        pick(suggestions[highlight]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative flex min-w-0 flex-col gap-1">
      {label && <span className="text-sm font-semibold text-text-secondary">{label}</span>}
      <input
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(e.target.value.trim().length >= MIN_CHARS);
          setHighlight(-1);
        }}
        onFocus={() => value.trim().length >= MIN_CHARS && setOpen(true)}
        onKeyDown={onKeyDown}
        className="min-h-[44px] w-full rounded-[var(--radius)] border border-border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-primary"
      />
      {showDropdown && (
        <ul
          role="listbox"
          className="absolute top-full z-20 mt-1 max-h-72 w-full overflow-auto rounded-[var(--radius)] border border-border bg-surface-card py-1 shadow-lg"
        >
          {search.isFetching ? (
            <li className="px-3 py-2 text-sm text-text-muted">Buscando…</li>
          ) : suggestions.length > 0 ? (
            suggestions.map((c, idx) => (
              <li
                key={c.id}
                role="option"
                aria-selected={highlight === idx}
                onMouseEnter={() => setHighlight(idx)}
                onMouseDown={(e) => {
                  // `onMouseDown` + preventDefault: el blur del input cerraría la lista
                  // antes de que llegue el click.
                  e.preventDefault();
                  pick(c);
                }}
                className={`flex min-w-0 cursor-pointer items-start justify-between gap-3 px-3 py-2 text-sm ${
                  highlight === idx ? 'bg-sky/20' : 'hover:bg-sky/10'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <span className="break-words font-semibold text-text-primary">{c.name}</span>
                    {c.code && (
                      <span className="whitespace-nowrap rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                        {c.code}
                      </span>
                    )}
                  </div>
                  <TagBadgeList tags={c.tags} className="mt-1" />
                </div>
                <AvailabilityTag available={c.available} />
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-text-muted">
              Sin coincidencias — puedes usar texto libre.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Disponibilidad: verde si sobra, ámbar si queda poco, rojo si es 0. */
function AvailabilityTag({ available }: { available: number }) {
  const tone =
    available <= 0
      ? 'bg-danger/10 text-danger'
      : available <= 5
        ? 'bg-ambar/20 text-ocre'
        : 'bg-success/10 text-success';
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      {available} disp.
    </span>
  );
}
