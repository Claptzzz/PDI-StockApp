import { useMemo, useState } from 'react';
import { useMyKit, useVerifyKit, useAcceptTerms, type VerifyKitItemInput } from '@/api/student';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import type { MyKitDetail, MyKitItem } from '@/lib/apiTypes';
import { ACTION_FOR_STUDENT } from '@/lib/discrepancy';
import { useToast } from '@/store/toast';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoanTermsModal } from '@/components/ui/LoanTermsModal';
import { Loading, ErrorState } from '@/components/ui/States';

interface KitVerificationCardProps {
  kitId: string;
  /** El aviso prominente pidió abrir el modal de verificación de ESTE kit. */
  verifyRequested?: boolean;
  /** Se llama al cerrar el modal, para que el padre limpie `verifyRequested`. */
  onVerifyClose?: () => void;
}

/**
 * Tarjeta por kit del alumno: estado de verificación (grupal) + aceptación de
 * condiciones (individual). Pide su propio detalle porque `/me/groups/:id` solo
 * trae los flags resumidos.
 */
export function KitVerificationCard({
  kitId,
  verifyRequested = false,
  onVerifyClose,
}: KitVerificationCardProps) {
  const kit = useMyKit(kitId);
  const [manualOpen, setManualOpen] = useState(false);

  if (kit.isLoading) return <Loading />;
  if (kit.isError) return <ErrorState message={getApiErrorMessage(kit.error)} />;
  if (!kit.data) return null;

  const data = kit.data;
  // Derivado, no un efecto: al verificarse `isVerified` pasa a true y el modal se cierra solo.
  const verifyOpen = (manualOpen || verifyRequested) && !data.isVerified;
  const closeVerify = () => {
    setManualOpen(false);
    onVerifyClose?.();
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-base font-bold text-text-primary">Kit {data.code}</h4>
        {data.isVerified ? (
          <Badge tone="success">Verificado</Badge>
        ) : (
          <Badge tone="ambar">Sin verificar</Badge>
        )}
      </div>

      {data.isVerified ? (
        <VerifiedSummary data={data} />
      ) : (
        <div className="mt-3">
          <p className="text-sm text-text-secondary">
            Revisa que el kit traiga todo lo que dice la lista antes de usarlo. Basta con que
            <strong className="text-text-primary"> un integrante</strong> lo haga, una sola vez.
          </p>
          <Button className="mt-3 w-full sm:w-auto" onClick={() => setManualOpen(true)}>
            Verificar kit
          </Button>
        </div>
      )}

      <AcceptanceBlock data={data} />

      {verifyOpen && <VerifyKitModal kitId={kitId} data={data} onClose={closeVerify} />}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Resultado de la verificación (solo lectura)
// ----------------------------------------------------------------------------

function VerifiedSummary({ data }: { data: MyKitDetail }) {
  const issues = data.items.filter((it) => !it.verified || it.verificationNote);
  const pending = issues.filter((it) => it.resolutions.length === 0);

  return (
    <div className="mt-3">
      <p className="text-sm text-text-secondary">
        Verificado por <strong className="text-text-primary">{data.verifiedBy?.name ?? '—'}</strong>{' '}
        el {formatDateTime(data.verifiedAt)}.
      </p>

      {pending.length > 0 ? (
        <div className="mt-2 rounded-[var(--radius)] border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ocre">
          Se registraron {pending.length} observación(es) pendientes. Tu profesor o ayudante las
          revisará; por ahora las cantidades del kit no cambian.
        </div>
      ) : issues.length > 0 ? (
        <div className="mt-2 rounded-[var(--radius)] border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          Tus {issues.length} observación(es) ya fueron resueltas. Revisa abajo qué se decidió.
        </div>
      ) : null}

      <ul className="mt-3 flex flex-col gap-2">
        {data.items.map((it) => (
          <li
            key={it.id}
            className="flex min-w-0 items-start gap-3 rounded-[var(--radius)] border border-border p-3"
          >
            <span
              aria-hidden
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                it.verified ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
              }`}
            >
              {it.verified ? '✓' : '✕'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-semibold text-text-primary">
                {it.componentName}{' '}
                <span className="font-normal text-text-secondary">×{it.quantity}</span>
              </p>
              <p className="text-xs text-text-secondary">
                {it.verified ? 'Recibido conforme' : 'No recibido / no conforme'}
              </p>
              {it.verificationNote && (
                <p className="mt-1 break-words rounded bg-gray-50 px-2 py-1 text-xs text-text-primary">
                  “{it.verificationNote}”
                </p>
              )}
              <StudentResolutions item={it} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Cierra el ciclo para el alumno: qué decidió el profesor sobre lo que reportó,
 * dicho en términos de lo que le afecta (si deberá devolverlo o no).
 */
function StudentResolutions({ item }: { item: MyKitItem }) {
  if (item.resolutions.length === 0) return null;

  return (
    <ul className="mt-1.5 flex min-w-0 flex-col gap-1.5">
      {item.resolutions.map((r) => (
        <li
          key={r.id}
          className="min-w-0 rounded-[var(--radius)] border border-success/30 bg-success/5 px-2 py-1.5"
        >
          <p className="break-words text-xs">
            <span className="font-bold text-success">Resuelto:</span>{' '}
            <span className="text-text-primary">{ACTION_FOR_STUDENT[r.action](r.quantity)}</span>
          </p>
          <p className="mt-0.5 break-words text-xs text-text-secondary">
            {r.resolvedBy.name} · {formatDateTime(r.createdAt)}
          </p>
          <p className="mt-0.5 break-words text-xs text-text-primary">“{r.note}”</p>
        </li>
      ))}
    </ul>
  );
}

// ----------------------------------------------------------------------------
// Modal de verificación (checklist)
// ----------------------------------------------------------------------------

interface DraftItem {
  verified: boolean;
  note: string;
}

function VerifyKitModal({
  kitId,
  data,
  onClose,
}: {
  kitId: string;
  data: MyKitDetail;
  onClose: () => void;
}) {
  const toast = useToast();
  const verify = useVerifyKit(kitId);

  // Todos parten marcados: el alumno DESMARCA lo que no recibió.
  const [draft, setDraft] = useState<Record<string, DraftItem>>(() =>
    Object.fromEntries(data.items.map((it) => [it.id, { verified: true, note: '' }])),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unchecked = data.items.filter((it) => !draft[it.id]?.verified);
  const withNote = data.items.filter((it) => draft[it.id]?.note.trim());

  const set = (id: string, patch: Partial<DraftItem>) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const submit = () => {
    const items: VerifyKitItemInput[] = data.items.map((it) => {
      const d = draft[it.id];
      const note = d.note.trim();
      return { kitItemId: it.id, verified: d.verified, ...(note ? { note } : {}) };
    });

    verify.mutate(items, {
      onSuccess: () => {
        toast.success('Verificación registrada.');
        setConfirmOpen(false);
        onClose();
      },
      onError: (err) => {
        setError(getApiErrorMessage(err));
        setConfirmOpen(false);
      },
    });
  };

  const confirmMessage = useMemo(() => {
    if (unchecked.length === 0 && withNote.length === 0) {
      return 'Vas a confirmar que recibiste todos los ítems conformes. Esto se registra una sola vez y no se puede deshacer.';
    }
    const parts: string[] = [];
    if (unchecked.length > 0) {
      parts.push(`${unchecked.length} ítem(s) SIN marcar: ${unchecked.map((i) => i.componentName).join(', ')}`);
    }
    if (withNote.length > 0) {
      parts.push(`${withNote.length} ítem(s) con observación: ${withNote.map((i) => i.componentName).join(', ')}`);
    }
    return `${parts.join('. ')}. Se registrará tal cual (no se ajustan cantidades ni stock) y no se puede deshacer.`;
  }, [unchecked, withNote]);

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={`Verificar kit ${data.code}`}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={verify.isPending}>
              Confirmar verificación
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">
            Todos los ítems parten marcados. <strong>Desmarca</strong> lo que no recibiste y agrega
            una nota si algo llegó mal.
          </p>

          {data.items.map((it) => {
            const d = draft[it.id];
            return (
              <div key={it.id} className="min-w-0 rounded-[var(--radius)] border border-border p-3">
                <Checkbox
                  checked={d.verified}
                  onChange={(e) => set(it.id, { verified: e.target.checked })}
                  label={
                    <span className="break-words font-semibold">
                      {it.componentName}{' '}
                      <span className="font-normal text-text-secondary">×{it.quantity}</span>
                    </span>
                  }
                  hint={d.verified ? 'Recibido conforme' : 'Marcado como NO recibido'}
                />
                <Textarea
                  className="mt-1"
                  aria-label={`Nota para ${it.componentName}`}
                  placeholder="Ej: llegó dañado, faltan 2 unidades…"
                  value={d.note}
                  onChange={(e) => set(it.id, { note: e.target.value })}
                />
              </div>
            );
          })}

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar verificación"
        message={confirmMessage}
        confirmLabel="Confirmar"
        danger={unchecked.length > 0 || withNote.length > 0}
        loading={verify.isPending}
        onConfirm={submit}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

// ----------------------------------------------------------------------------
// Aceptación de condiciones (individual)
// ----------------------------------------------------------------------------

function AcceptanceBlock({ data }: { data: MyKitDetail }) {
  const toast = useToast();
  const accept = useAcceptTerms(data.id);
  const [termsOpen, setTermsOpen] = useState(false);
  const [hasRead, setHasRead] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = data.members.filter((m) => !m.accepted);
  const acceptedCount = data.members.length - pending.length;

  const submit = () => {
    if (!data.termsVersion) return;
    setError(null);
    accept.mutate(data.termsVersion, {
      onSuccess: () => toast.success('Condiciones aceptadas.'),
      onError: (err) => setError(getApiErrorMessage(err)),
    });
  };

  const groupStatus = (
    <div className="mt-3 border-t border-border pt-3">
      <p className="text-sm text-text-secondary">
        <strong className="text-text-primary">
          {acceptedCount} de {data.members.length}
        </strong>{' '}
        integrante(s) han aceptado las condiciones.
      </p>
      {pending.length > 0 && (
        <p className="mt-1 break-words text-xs text-text-secondary">
          Faltan: <span className="font-semibold text-ocre">{pending.map((m) => m.name).join(', ')}</span>
        </p>
      )}
    </div>
  );

  return (
    <section className="mt-4 rounded-[var(--radius)] border border-border bg-gray-50 p-3 sm:p-4">
      <h5 className="text-sm font-bold text-text-primary">Condiciones de préstamo</h5>

      {data.hasAccepted ? (
        <>
          <div className="mt-2 rounded-[var(--radius)] border border-success/30 bg-success/10 px-3 py-2 text-sm font-semibold text-success">
            ✓ Aceptaste el {formatDateTime(data.myAcceptedAt)}
          </div>
          <button
            type="button"
            onClick={() => setTermsOpen(true)}
            className="mt-2 text-sm font-semibold text-primary underline underline-offset-2"
          >
            Releer las condiciones
          </button>
          {groupStatus}
        </>
      ) : !data.isVerified ? (
        <>
          <p className="mt-2 rounded-[var(--radius)] border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ocre">
            Primero deben verificar el kit. Una vez verificado podrás aceptar las condiciones.
          </p>
          <Checkbox
            disabled
            checked={false}
            onChange={() => undefined}
            label="Acepto las condiciones de préstamo"
          />
          {groupStatus}
        </>
      ) : !data.canAccept ? (
        // El curso aún no tiene condiciones publicadas: el kit se ve y se verifica
        // igual, pero no hay texto que firmar todavía.
        <>
          <p className="mt-2 rounded-[var(--radius)] border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ocre">
            {data.acceptBlockedReason ??
              'Las condiciones de préstamo de este curso todavía no están disponibles.'}
          </p>
          <Checkbox
            disabled
            checked={false}
            onChange={() => undefined}
            label="Acepto las condiciones de préstamo"
          />
          {groupStatus}
        </>
      ) : (
        <>
          <Checkbox
            checked={checked}
            disabled={!hasRead}
            onChange={(e) => setChecked(e.target.checked)}
            label={
              <>
                Acepto las{' '}
                <button
                  type="button"
                  // `stopPropagation`: el <label> del checkbox envuelve este botón.
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTermsOpen(true);
                  }}
                  className="font-semibold text-primary underline underline-offset-2"
                >
                  condiciones de préstamo
                </button>
              </>
            }
            hint={
              hasRead
                ? 'Aceptas solo por ti; cada integrante debe aceptar por su cuenta.'
                : 'Abre y lee las condiciones para poder aceptar.'
            }
          />

          <Button
            className="mt-2 w-full sm:w-auto"
            onClick={submit}
            disabled={!checked || accept.isPending}
          >
            {accept.isPending ? 'Guardando…' : 'Confirmar aceptación'}
          </Button>

          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          {groupStatus}
        </>
      )}

      <LoanTermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        courseId={data.courseId}
        onRead={() => setHasRead(true)}
      />
    </section>
  );
}
