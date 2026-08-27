import { useMemo, useState } from 'react';
import { useComponent } from '@/api/components';
import type { DiscrepancyAction, KitItem } from '@/lib/apiTypes';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';

interface ActionDef {
  id: DiscrepancyAction;
  title: string;
  description: string;
  /** Solo aplicable si el ítem está enlazado al catálogo. */
  needsComponent?: boolean;
}

const ACTIONS: ActionDef[] = [
  {
    id: 'ACKNOWLEDGED',
    title: 'Solo dejar constancia',
    description:
      'El ítem queda revisado, sin cambios. Para daños cosméticos que no impiden usarlo.',
  },
  {
    id: 'REPLACED',
    title: 'Reponer el componente',
    description:
      'Se entrega el componente faltante o dañado. El ítem vuelve a estar conforme y el grupo deberá devolver la cantidad original.',
  },
  {
    id: 'DEDUCTED',
    title: 'Descontar del kit',
    description:
      'El componente no venía y no se repone. Se reduce la cantidad exigida del kit; el grupo no deberá devolverla.',
  },
  {
    id: 'WRITE_OFF',
    title: 'Dar de baja del inventario',
    description:
      'El componente se dañó y ya no sirve. Se reduce el stock total en bodega y también la cantidad exigida del kit.',
    needsComponent: true,
  },
];

interface DiscrepancyResolutionModalProps {
  item: KitItem;
  loading?: boolean;
  error?: string | null;
  onConfirm: (action: DiscrepancyAction, quantity: number, note: string) => void;
  onClose: () => void;
}

/**
 * Cierra una discrepancia reportada por el alumno. Antes de confirmar se resume en
 * lenguaje llano el efecto de la acción elegida, porque dos de las cuatro modifican
 * datos que no son obvios (la cantidad exigida del kit y el stock de bodega).
 */
export function DiscrepancyResolutionModal({
  item,
  loading = false,
  error,
  onConfirm,
  onClose,
}: DiscrepancyResolutionModalProps) {
  const [action, setAction] = useState<DiscrepancyAction>('ACKNOWLEDGED');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const linked = Boolean(item.componentId);
  // Se consulta aquí (y no desde el padre) para poder anticipar el stock resultante
  // en el resumen del efecto de "dar de baja".
  const component = useComponent(item.componentId);
  const componentTotalStock = component.data?.totalStock;
  const qty = Number(quantity);
  const qtyValid = Number.isInteger(qty) && qty >= 1 && qty <= item.quantity;

  const effect = useMemo(() => {
    if (!qtyValid) return null;
    const unit = `${qty} unidad${qty === 1 ? '' : 'es'}`;
    switch (action) {
      case 'ACKNOWLEDGED':
        return 'Se deja constancia de la revisión. No cambia la cantidad del kit ni el stock.';
      case 'REPLACED':
        return `Se registra la reposición de ${unit}. El ítem queda conforme y el grupo deberá devolver las ${item.quantity} unidades.`;
      case 'DEDUCTED':
        return `Se descontarán ${unit} del kit: la cantidad exigida pasará de ${item.quantity} a ${Math.max(item.returnedQuantity, item.quantity - qty)} — el grupo no deberá devolverlas.`;
      case 'WRITE_OFF':
        return (
          `Se dará de baja ${unit} del inventario` +
          (componentTotalStock !== undefined
            ? `: el stock total de ${item.componentName} pasará de ${componentTotalStock} a ${componentTotalStock - qty}`
            : '') +
          `. Además la cantidad exigida del kit pasará de ${item.quantity} a ${Math.max(item.returnedQuantity, item.quantity - qty)}.`
        );
    }
  }, [action, qty, qtyValid, item, componentTotalStock]);

  const submit = () => {
    if (!qtyValid) {
      setLocalError(`La cantidad debe ser un entero entre 1 y ${item.quantity}.`);
      return;
    }
    if (!note.trim()) {
      setLocalError('La nota es obligatoria: explica la decisión.');
      return;
    }
    setLocalError(null);
    onConfirm(action, qty, note.trim());
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Resolver discrepancia"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? 'Guardando…' : 'Confirmar resolución'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Contexto: qué es y qué reportó el alumno. */}
        <div className="min-w-0 rounded-[var(--radius)] border border-border bg-gray-50 p-3">
          <p className="break-words font-semibold text-text-primary">
            {item.componentName}{' '}
            <span className="font-normal text-text-secondary">×{item.quantity} en el kit</span>
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            El grupo lo marcó como{' '}
            <span className="font-semibold text-danger">
              {item.verified ? 'conforme, pero con observación' : 'no recibido / no conforme'}
            </span>
            .
          </p>
          {item.verificationNote && (
            <p className="mt-1.5 break-words rounded-[var(--radius)] border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-ocre">
              “{item.verificationNote}”
            </p>
          )}
        </div>

        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-text-secondary">Acción</legend>
          {ACTIONS.map((a) => {
            const disabled = a.needsComponent && !linked;
            const selected = action === a.id;
            return (
              <label
                key={a.id}
                className={`flex min-w-0 items-start gap-3 rounded-[var(--radius)] border p-3 transition-colors ${
                  disabled
                    ? 'cursor-not-allowed border-border opacity-60'
                    : `cursor-pointer ${selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary'}`
                }`}
              >
                <input
                  type="radio"
                  name="discrepancy-action"
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary)]"
                  checked={selected}
                  disabled={disabled}
                  onChange={() => {
                    setAction(a.id);
                    setLocalError(null);
                  }}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text-primary">{a.title}</span>
                  <span className="mt-0.5 block text-xs text-text-secondary">{a.description}</span>
                  {disabled && (
                    <span className="mt-1 block text-xs font-semibold text-ocre">
                      No disponible: este ítem no está enlazado al catálogo de bodega.
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>

        <Input
          label="Cantidad afectada"
          type="number"
          min={1}
          max={item.quantity}
          className="w-32"
          value={quantity}
          onChange={(e) => {
            setQuantity(e.target.value);
            setLocalError(null);
          }}
        />

        <Textarea
          label="Nota (obligatoria)"
          rows={3}
          placeholder="Explica la decisión: qué pasó y qué se hizo…"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setLocalError(null);
          }}
        />

        {effect && (
          <p className="rounded-[var(--radius)] border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-text-primary">
            <span className="font-semibold">Efecto:</span> {effect}
          </p>
        )}

        {(localError || error) && (
          <p className="break-words text-sm text-danger">{localError ?? error}</p>
        )}
      </div>
    </Modal>
  );
}
