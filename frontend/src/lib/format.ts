/** Formatea un periodo académico como "2026/01". */
export const formatPeriod = (year: number, semester: number) =>
  `${year}/${semester === 1 ? '01' : '02'}`;

/** Fecha corta legible en es-CL: "26 ago 2026". */
export const formatDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

/**
 * Fecha + hora: "26 ago 2026, 15:04".
 * `hour12: false` a propósito: el AM/PM de es-CL ("a. m.") termina en punto y
 * choca con el punto de la frase que lo sigue.
 */
export const formatDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('es-CL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '—';
