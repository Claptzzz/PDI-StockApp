import { useState } from 'react';
import { useCreateTag } from '@/api/tags';
import { getApiErrorMessage } from '@/lib/errors';
import type { Tag } from '@/lib/apiTypes';
import { DEFAULT_TAG_COLOR, normalizeHex, tagStyles } from '@/lib/tagColor';
import { Button } from './Button';

interface TagMultiSelectProps {
  tags: Tag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Permite crear una etiqueta nueva sin salir del formulario (solo ADMIN). */
  allowCreate?: boolean;
}

/**
 * Selector múltiple de etiquetas: pills activables + creación al vuelo.
 * Se usa dentro del modal de componente, por eso prioriza el alto sobre el ancho.
 */
export function TagMultiSelect({
  tags,
  selectedIds,
  onChange,
  allowCreate = true,
}: TagMultiSelectProps) {
  const createTag = useCreateTag();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_TAG_COLOR);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  const create = () => {
    const name = newName.trim();
    if (!name) return setError('Escribe un nombre para la etiqueta.');

    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      // Ya existe: en vez de fallar con 409, simplemente la selecciona.
      if (!selectedIds.includes(existing.id)) onChange([...selectedIds, existing.id]);
      setNewName('');
      setError(null);
      return;
    }

    setError(null);
    createTag.mutate(
      { name, color: newColor },
      {
        onSuccess: (tag) => {
          onChange([...selectedIds, tag.id]);
          setNewName('');
        },
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-text-secondary">Etiquetas</span>

      {tags.length > 0 ? (
        <div className="flex min-w-0 flex-wrap gap-2">
          {tags.map((tag) => {
            const active = selectedIds.includes(tag.id);
            const hex = normalizeHex(tag.color);
            return (
              <button
                key={tag.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(tag.id)}
                style={
                  active
                    ? { backgroundColor: hex, borderColor: hex, color: '#ffffff' }
                    : tagStyles(tag.color)
                }
                className="inline-flex max-w-full items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-85"
              >
                {active && <span aria-hidden>✓</span>}
                <span className="truncate">{tag.name}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-text-muted">Aún no hay etiquetas; crea la primera abajo.</p>
      )}

      {allowCreate && (
        <div className="mt-1 rounded-[var(--radius)] border border-dashed border-border p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Crear etiqueta nueva
          </span>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={newName}
              placeholder="Nombre de la etiqueta…"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  create();
                }
              }}
              className="min-h-[44px] min-w-0 flex-1 rounded-[var(--radius)] border border-border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
            />
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Color de la etiqueta"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-11 w-12 shrink-0 cursor-pointer rounded-[var(--radius)] border border-border bg-surface-card p-1"
              />
              <Button
                variant="secondary"
                onClick={create}
                disabled={createTag.isPending}
                className="shrink-0"
              >
                Agregar
              </Button>
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
