import type { Tag } from '@/lib/apiTypes';
import { hexWithAlpha, normalizeHex, tagStyles } from '@/lib/tagColor';

interface TagChipsProps {
  tags: Tag[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** Muestra el conteo de componentes junto al nombre (vista de filtros). */
  showCount?: boolean;
  emptyMessage?: string;
}

/**
 * Pills de etiquetas activables. `flex-wrap` + `min-w-0` para que en móvil
 * hagan salto de línea en vez de desbordar el ancho de la tarjeta.
 */
export function TagChips({
  tags,
  selectedIds,
  onToggle,
  showCount = false,
  emptyMessage = 'Aún no hay etiquetas.',
}: TagChipsProps) {
  if (tags.length === 0) {
    return <p className="text-sm text-text-muted">{emptyMessage}</p>;
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      {tags.map((tag) => {
        const active = selectedIds.includes(tag.id);
        const hex = normalizeHex(tag.color);
        const style = active
          ? { backgroundColor: hex, borderColor: hex, color: '#ffffff' }
          : tagStyles(tag.color);

        return (
          <button
            key={tag.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(tag.id)}
            style={style}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2"
          >
            <span className="truncate">{tag.name}</span>
            {showCount && (
              <span
                className="shrink-0 rounded-full px-1.5 text-[10px] leading-4"
                style={{
                  backgroundColor: active ? hexWithAlpha('#ffffff', 0.25) : hexWithAlpha(hex, 0.18),
                }}
              >
                {tag.componentsCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
