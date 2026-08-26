import { useLoanTerms } from '@/api/terms';
import { getApiErrorMessage } from '@/lib/errors';
import { Modal } from './Modal';
import { Button } from './Button';
import { Loading, ErrorState } from './States';

interface LoanTermsModalProps {
  open: boolean;
  onClose: () => void;
  /** Se dispara al cerrar habiendo cargado el texto: habilita el checkbox de aceptación. */
  onRead?: (version: string) => void;
}

/**
 * Texto completo de las condiciones de préstamo (GET /terms).
 * El Modal base ya ocupa casi toda la pantalla en móvil con scroll interno.
 */
export function LoanTermsModal({ open, onClose, onRead }: LoanTermsModalProps) {
  const terms = useLoanTerms(open);

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
        <div>
          {/* `whitespace-pre-wrap` respeta los saltos del texto; `break-words` evita
              desbordes horizontales en móvil si aparece una palabra muy larga. */}
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-primary">
            {terms.data.body}
          </p>
          <p className="mt-4 border-t border-border pt-3 text-xs text-text-muted">
            Versión {terms.data.version}
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
