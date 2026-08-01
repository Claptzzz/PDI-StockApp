import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchStudents } from '@/api/users';
import { useAddAssistant } from '@/api/courses';
import { getApiErrorMessage } from '@/lib/errors';
import type { CourseAssistant, StudentSearchResult } from '@/lib/apiTypes';
import { useToast } from '@/store/toast';
import { Button } from './Button';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isStudentEmail = (value: string) => {
  const v = value.trim().toLowerCase();
  return EMAIL_RE.test(v) && v.endsWith('@alumnos.ucn.cl');
};

type Option = { type: 'student'; user: StudentSearchResult } | { type: 'fallback'; email: string };

interface AssistantPickerProps {
  courseId: string;
  /** Ayudantes ya asignados al curso, para excluirlos de las sugerencias. */
  assigned: CourseAssistant[];
}

export function AssistantPicker({ courseId, assigned }: AssistantPickerProps) {
  const toast = useToast();
  const addAssistant = useAddAssistant(courseId);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const search = useSearchStudents(debounced);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const assignedEmails = useMemo(
    () => new Set(assigned.map((a) => a.assistant.email.toLowerCase())),
    [assigned],
  );
  const assignedIds = useMemo(() => new Set(assigned.map((a) => a.assistantId)), [assigned]);

  const suggestions = useMemo(
    () =>
      (search.data ?? []).filter(
        (u) => !assignedEmails.has(u.email.toLowerCase()) && !assignedIds.has(u.id),
      ),
    [search.data, assignedEmails, assignedIds],
  );

  const typedEmail = isStudentEmail(query) ? query.trim().toLowerCase() : null;

  const options = useMemo<Option[]>(() => {
    const opts: Option[] = suggestions.map((user) => ({ type: 'student', user }));
    if (
      typedEmail &&
      !suggestions.some((s) => s.email.toLowerCase() === typedEmail) &&
      !assignedEmails.has(typedEmail)
    ) {
      opts.push({ type: 'fallback', email: typedEmail });
    }
    return opts;
  }, [suggestions, typedEmail, assignedEmails]);

  const emailOf = (opt: Option) => (opt.type === 'student' ? opt.user.email : opt.email);
  const effectiveEmail =
    highlight >= 0 && options[highlight] ? emailOf(options[highlight]) : typedEmail;

  const showDropdown = open && query.trim().length >= 2;
  const loading = search.isFetching || (query.trim().length >= 2 && query.trim() !== debounced);

  const reset = () => {
    setQuery('');
    setDebounced('');
    setOpen(false);
    setHighlight(-1);
  };

  const submit = (email: string | null) => {
    if (!email) return;
    addAssistant.mutate(email, {
      onSuccess: () => {
        toast.success('Ayudante agregado.');
        reset();
      },
      onError: (err) => toast.error(getApiErrorMessage(err)),
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submit(effectiveEmail);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlight(-1);
    }
  };

  const hint =
    query.trim().length > 0 && !effectiveEmail
      ? 'Elige un alumno o escribe un correo @alumnos.ucn.cl válido.'
      : null;

  return (
    <div className="flex items-end gap-2">
      <div ref={containerRef} className="relative flex-1">
        <label htmlFor="assistant-picker" className="text-sm font-semibold text-text-secondary">
          Agregar ayudante (nombre o correo del alumno)
        </label>
        <input
          id="assistant-picker"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="assistant-listbox"
          aria-autocomplete="list"
          aria-activedescendant={highlight >= 0 ? `assistant-opt-${highlight}` : undefined}
          autoComplete="off"
          placeholder="Ej: Ana o ana.torres@alumnos.ucn.cl"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(e.target.value.trim().length >= 2);
            setHighlight(-1);
          }}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onKeyDown={onKeyDown}
          className="mt-1 min-h-[44px] w-full rounded-[var(--radius)] border border-border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-primary"
        />

        {showDropdown && (
          <ul
            id="assistant-listbox"
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-[var(--radius)] border border-border bg-surface-card py-1 shadow-lg"
          >
            {loading ? (
              <li className="flex items-center gap-2 px-3 py-2 text-sm text-text-muted">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky border-t-transparent" />
                Buscando…
              </li>
            ) : search.isError ? (
              <li className="px-3 py-2 text-sm text-danger">Error al buscar alumnos.</li>
            ) : options.length > 0 ? (
              options.map((opt, idx) => (
                <li
                  key={opt.type === 'student' ? opt.user.id : `fallback-${opt.email}`}
                  id={`assistant-opt-${idx}`}
                  role="option"
                  aria-selected={highlight === idx}
                  onMouseEnter={() => setHighlight(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    submit(emailOf(opt));
                  }}
                  className={`cursor-pointer px-3 py-2 text-sm ${
                    highlight === idx ? 'bg-sky/20' : 'hover:bg-sky/10'
                  }`}
                >
                  {opt.type === 'student' ? (
                    <>
                      <div className="font-semibold text-text-primary">{opt.user.name}</div>
                      <div className="text-xs text-text-secondary">{opt.user.email}</div>
                    </>
                  ) : (
                    <div className="text-text-primary">
                      Agregar <span className="font-semibold">{opt.email}</span>
                      <span className="text-text-muted"> (pre-registro)</span>
                    </div>
                  )}
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-sm text-text-muted">
                Sin coincidencias — usa un correo @alumnos.ucn.cl.
              </li>
            )}
          </ul>
        )}

        {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
      </div>

      <Button
        onClick={() => submit(effectiveEmail)}
        disabled={!effectiveEmail || addAssistant.isPending}
      >
        Agregar
      </Button>
    </div>
  );
}
