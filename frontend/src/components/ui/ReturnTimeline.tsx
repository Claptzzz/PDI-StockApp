import type { ReturnEvent } from '@/lib/apiTypes';
import { formatDateTime, formatShortDateTime } from '@/lib/format';

/**
 * Mini-timeline del historial de devoluciones de un ítem o préstamo.
 * En móvil cada evento se apila: la línea de metadatos hace wrap y la nota va debajo.
 */
export function ReturnTimeline({
  events,
  className = '',
}: {
  events: ReturnEvent[];
  className?: string;
}) {
  if (events.length === 0) return null;

  return (
    <ol className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      {events.map((e) => (
        <li key={e.id} className="flex min-w-0 gap-2">
          <span
            aria-hidden
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted"
          />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-text-secondary">
              <span className="font-semibold text-text-primary" title={formatDateTime(e.createdAt)}>
                {formatShortDateTime(e.createdAt)}
              </span>
              <span aria-hidden>·</span>
              <span>{e.quantity} unidad{e.quantity === 1 ? '' : 'es'}</span>
              <span aria-hidden>·</span>
              <span className="break-words">recibido por {e.receivedBy.name}</span>
            </p>
            {e.note && (
              // Con observación: color de warning del theme para que salte a la vista.
              // `max-w-2xl`: en desktop la nota no debe estirarse a todo el ancho de la tabla.
              <p className="mt-1 max-w-2xl break-words rounded-[var(--radius)] border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-ocre">
                {e.note}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Badge compacto para señalar que hay observaciones sin desplegar el historial. */
export function ReturnNotesFlag({ className = '' }: { className?: string }) {
  return (
    <span
      title="Hay observaciones en las devoluciones"
      className={`inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-ocre ${className}`}
    >
      <span aria-hidden>⚑</span> Con observaciones
    </span>
  );
}
