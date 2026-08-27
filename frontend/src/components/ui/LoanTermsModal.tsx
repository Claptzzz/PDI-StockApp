import { useLoanTerms } from '@/api/terms';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { Modal } from './Modal';
import { Button } from './Button';
import { Markdown } from './Markdown';
import { Loading, ErrorState } from './States';

interface LoanTermsModalProps {
  open: boolean;
  onClose: () => void;
  /** Curso del kit: determina qué documento rige (el suyo o el global). */
  courseId?: string;
  /** Se dispara al cerrar habiendo cargado el texto: habilita el checkbox de aceptación. */
  onRead?: (version: string) => void;
}

/**
 * Texto completo de las condiciones vigentes para el curso del kit.
 * El Modal base ya ocupa casi toda la pantalla en móvil con scroll interno.
 */
export function LoanTermsModal({ open, onClose, courseId, onRead }: LoanTermsModalProps) {
  const terms = useLoanTerms(open, courseId);

  const close = () => {
    if (terms.data) onRead?.(terms.data.version);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={terms.data?.title ?? 'Condiciones de préstamo'}
      footer={
        <Button onClick={close} disabled={terms.isLoading}>
          {terms.isError ? 'Cerrar' : 'Entendido'}
        </Button>
      }
    >
      {terms.isLoading ? (
        <Loading />
      ) : terms.isError ? (
        <ErrorState message={getApiErrorMessage(terms.error)} />
      ) : terms.data ? (
        <div className="min-w-0">
          {/* El cuerpo es markdown; el renderer escapa cualquier HTML del autor. */}
          <Markdown>{terms.data.body}</Markdown>
          <p className="mt-4 break-words border-t border-border pt-3 text-xs text-text-muted">
            Versión {terms.data.version} · publicada el {formatDate(terms.data.publishedAt)}
            {terms.data.documentName && ` · ${terms.data.documentName}`}
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
