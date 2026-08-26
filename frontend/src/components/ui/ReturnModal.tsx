import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';

interface ReturnModalProps {
  /** Nombre del componente que se devuelve (encabeza el modal). */
  componentName: string;
  /** Unidades aún pendientes; es el máximo aceptado y el valor por defecto. */
  pending: number;
  loading?: boolean;
  error?: string | null;
  onConfirm: (quantity: number, note: string) => void;
  onClose: () => void;
}

/**
 * Modal de devolución compartido por kits y préstamos: cantidad + nota opcional.
 * Se hizo modal (y no un input en la fila) porque la nota necesita un textarea
 * cómodo, que en móvil no cabe dentro de la tabla.
 */
export function ReturnModal({
  componentName,
  pending,
  loading = false,
  error,
  onConfirm,
  onClose,
}: ReturnModalProps) {
  const [quantity, setQuantity] = useState(String(pending));
  const [note, setNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > pending) {
      setLocalError(`La cantidad debe ser un entero entre 1 y ${pending}.`);
      return;
    }
    setLocalError(null);
    onConfirm(qty, note.trim());
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Registrar devolución"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? 'Guardando…' : 'Registrar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="break-words font-semibold text-text-primary">{componentName}</p>
          <p className="text-sm text-text-secondary">{pending} unidad(es) pendiente(s).</p>
        </div>

        <Input
          label="Cantidad a devolver"
          type="number"
          min={1}
          max={pending}
          className="w-32"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />

        <Textarea
          label="Nota (opcional)"
          rows={3}
          placeholder="Opcional: estado del componente, daños, observaciones…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {(localError || error) && <p className="text-sm text-danger">{localError ?? error}</p>}
      </div>
    </Modal>
  );
}
