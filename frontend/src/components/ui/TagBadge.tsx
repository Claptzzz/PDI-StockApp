import type { TagRef } from '@/lib/apiTypes';
import { tagStyles } from '@/lib/tagColor';

/** Badge de etiqueta con el color que definió el admin (hex libre → estilo inline). */
export function TagBadge({ tag, className = '' }: { tag: TagRef; className?: string }) {
  return (
    <span
      style={tagStyles(tag.color)}
      className={`inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`}
      title={tag.name}
    >
      {tag.name}
    </span>
  );
}

/** Lista de badges que hace wrap; no renderiza nada si no hay etiquetas. */
export function TagBadgeList({ tags, className = '' }: { tags: TagRef[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <span className={`flex flex-wrap gap-1 ${className}`}>
      {tags.map((t) => (
        <TagBadge key={t.id} tag={t} />
      ))}
    </span>
  );
}
