import { useEffect, useRef, useState } from 'react';
import { useComponents } from '@/api/components';
import type { Component } from '@/lib/apiTypes';

interface ComponentComboboxProps {
  value: string;
  label?: string;
  placeholder?: string;
  /** Cambio de texto libre (el padre debería limpiar el componentId seleccionado). */
  onChange: (text: string) => void;
  /** Se eligió una sugerencia (componente real de bodega). */
  onPick: (component: Component) => void;
}

export function ComponentCombobox({
  value,
  label,
  placeholder,
  onChange,
  onPick,
}: ComponentComboboxProps) {
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState('');
  const [highlight, setHighlight] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value.trim()), 250);
    return () => clearTimeout(id);
  }, [value]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const search = useComponents(debounced.length >= 2 ? debounced : '');
  const suggestions = debounced.length >= 2 ? (search.data ?? []) : [];
  const showDropdown = open && debounced.length >= 2;

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
    <div ref={ref} className="relative flex flex-col gap-1">
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
          setOpen(e.target.value.trim().length >= 2);
          setHighlight(-1);
        }}
        onFocus={() => value.trim().length >= 2 && setOpen(true)}
        onKeyDown={onKeyDown}
        className="rounded-[var(--radius)] border border-border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-primary"
      />
      {showDropdown && (
        <ul
          role="listbox"
          className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-auto rounded-[var(--radius)] border border-border bg-surface-card py-1 shadow-lg"
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
                  e.preventDefault();
                  pick(c);
                }}
                className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                  highlight === idx ? 'bg-sky/20' : 'hover:bg-sky/10'
                }`}
              >
                <span className="text-text-primary">{c.name}</span>
                <span
                  className={`text-xs font-semibold ${c.available > 0 ? 'text-success' : 'text-danger'}`}
                >
                  {c.available} disp.
                </span>
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
