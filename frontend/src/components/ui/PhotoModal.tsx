import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

interface PhotoModalProps {
  open: boolean;
  onClose: () => void;
  /** URL firmada de Supabase. Expira ~1h. */
  url: string | null;
  /** Pie de foto: nombre del componente. */
  title: string;
  /** Pie de foto: fecha del préstamo, ya formateada. */
  subtitle?: string;
  /** Vuelve a pedir los datos para obtener una signedUrl fresca. */
  onReload: () => void;
  reloading?: boolean;
}

/**
 * Visor de la foto de evidencia. Reemplaza el `<a target="_blank">` para no sacar
 * al usuario del flujo. Se monta en un portal propio (no reutiliza `Modal`) porque
 * necesita fondo casi opaco y la imagen a sangre en móvil.
 */
export function PhotoModal({
  open,
  onClose,
  url,
  title,
  subtitle,
  onReload,
  reloading = false,
}: PhotoModalProps) {
  // Se guarda la URL que falló, no un boolean: así una signedUrl nueva vuelve a
  // intentarse sola, sin un efecto que resetee el estado.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = url !== null && failedUrl === url;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80 p-0 sm:p-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex min-h-0 flex-1 flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={`Foto de evidencia: ${title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-end px-3 py-2 sm:px-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-xl text-white transition-colors hover:bg-black/60"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center px-3 sm:px-0">
          {!url || failed ? (
            <div className="max-w-sm rounded-[var(--radius-card)] bg-surface-card p-5 text-center">
              <p className="text-sm font-semibold text-text-primary">
                No se pudo cargar la imagen
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                El enlace de la foto expira aproximadamente cada hora. Recárgala para obtener uno
                nuevo.
              </p>
              <Button className="mt-3" onClick={onReload} disabled={reloading}>
                {reloading ? 'Recargando…' : 'Recargar'}
              </Button>
            </div>
          ) : (
            // `touch-pinch-zoom` deja el pinch al navegador; `object-contain` no deforma.
            <img
              src={url}
              alt={`Evidencia de ${title}`}
              onError={() => setFailedUrl(url)}
              className="max-h-full max-w-full touch-pinch-zoom rounded-[var(--radius)] object-contain"
            />
          )}
        </div>

        <div className="shrink-0 bg-black/40 px-4 py-3 text-white sm:mt-3 sm:rounded-[var(--radius)]">
          <p className="break-words text-sm font-semibold">{title}</p>
          {subtitle && <p className="text-xs text-white/70">{subtitle}</p>}
          {url && !failed && (
            <div className="mt-2 flex flex-wrap gap-4">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-white underline underline-offset-2"
              >
                Abrir en pestaña nueva
              </a>
              <a
                href={url}
                download
                className="text-xs font-semibold text-white underline underline-offset-2"
              >
                Descargar
              </a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
