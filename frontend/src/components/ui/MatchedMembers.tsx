import type { Member } from '@/lib/apiTypes';

/**
 * Señala por qué integrante coincidió un grupo en la búsqueda. No se renderiza
 * cuando el match fue por el nombre del grupo (lista vacía).
 */
export function MatchedMembers({ members }: { members: Member[] }) {
  if (members.length === 0) return null;

  return (
    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
      <span className="text-xs text-text-secondary">Coincide por:</span>
      {members.map((m) => (
        <span
          key={m.id}
          title={m.email}
          className="inline-flex max-w-full items-center truncate rounded-full bg-ambar/20 px-2 py-0.5 text-xs font-semibold text-ocre"
        >
          {m.name}
        </span>
      ))}
    </div>
  );
}
