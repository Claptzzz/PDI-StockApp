import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTerms } from '@/api/courses';
import { useOverview, useStock, useUsage, usePendingReturns, type Period } from '@/api/metrics';
import { getApiErrorMessage } from '@/lib/errors';
import type { StockRow, UsageRow } from '@/lib/apiTypes';
import { Badge } from '@/components/ui/Badge';
import { TagBadgeList } from '@/components/ui/TagBadge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, Td, Th } from '@/components/ui/Table';
import { Loading, ErrorState } from '@/components/ui/States';
import {
  MAX_THRESHOLD,
  THRESHOLD_PRESETS,
  isValidThreshold,
  useMetricsThresholdStore,
} from '@/store/metricsThreshold';

function useUcnColors() {
  return useMemo(() => {
    const read = (name: string, fallback: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    return {
      navy: read('--ucn-navy', '#151f3f'),
      blue: read('--ucn-blue', '#166499'),
      sky: read('--ucn-sky', '#7c9ac0'),
      ambar: read('--ucn-ambar', '#d5a140'),
      danger: read('--color-danger', '#b3261e'),
      success: read('--color-success', '#2e7d32'),
      border: read('--border', '#dde2ea'),
      textSecondary: read('--text-secondary', '#586274'),
    };
  }, []);
}

export function MetricsPage() {
  const terms = useTerms();
  const [value, setValue] = useState(''); // '' = todos los periodos

  const period: Period = useMemo(() => {
    if (!value) return {};
    const [year, semester] = value.split('-').map(Number);
    return { year, semester };
  }, [value]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Métricas</h1>
          <p className="mt-1 text-text-secondary">Resumen operativo de la plataforma.</p>
        </div>
        <div className="w-52">
          <Select label="Periodo" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Todos los periodos</option>
            {(terms.data ?? []).map((t) => (
              <option key={`${t.year}-${t.semester}`} value={`${t.year}-${t.semester}`}>
                {t.year}/{t.semester === 1 ? '01' : '02'}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <OverviewCards period={period} />
      <ReplenishSection />
      <UsageSection period={period} />
      <PendingReturnsSection period={period} />
    </div>
  );
}

// --- a) Resumen ---

function OverviewCards({ period }: { period: Period }) {
  const overview = useOverview(period);

  return (
    <section className="mt-6">
      {overview.isLoading ? (
        <Loading />
      ) : overview.isError ? (
        <ErrorState message={getApiErrorMessage(overview.error)} />
      ) : overview.data ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Cursos" value={overview.data.courses} />
          <StatCard label="Grupos" value={overview.data.groups} />
          <StatCard label="Estudiantes" value={overview.data.students} />
          <StatCard label="Kits asignados" value={overview.data.kitsAssigned} tone="ambar" />
          <StatCard label="Kits devueltos" value={overview.data.kitsReturned} tone="success" />
          <StatCard
            label="Préstamos pend."
            value={`${overview.data.loansPending}/${overview.data.loansTotal}`}
            tone={overview.data.loansPending > 0 ? 'danger' : 'success'}
          />
        </div>
      ) : null}
    </section>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'ambar' | 'success' | 'danger';
}) {
  const toneClass =
    tone === 'ambar'
      ? 'text-ocre'
      : tone === 'success'
        ? 'text-success'
        : tone === 'danger'
          ? 'text-danger'
          : 'text-text-primary';
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface-card p-4">
      <div className={`text-3xl font-bold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {label}
      </div>
    </div>
  );
}

// --- b) Reposición de bodega ---

/** Cuántas columnas caben cómodamente en el gráfico. */
const REPLENISH_TOP_N = 12;
/** Ancho reservado por columna: bajo esto el eje X se vuelve ilegible. */
const COLUMN_WIDTH = 64;

/** Abrevia nombres largos para el eje X (el completo va en el tooltip). */
function shortName(name: string, max = 14): string {
  return name.length <= max ? name : `${name.slice(0, max - 1)}…`;
}

function ReplenishSection() {
  const stock = useStock();
  const colors = useUcnColors();
  // Persistido: sobrevive a recargas y a salir de /admin/metricas.
  const { threshold, onlyBelow, setThreshold, setOnlyBelow } = useMetricsThresholdStore();
  const [copied, setCopied] = useState(false);

  const rows = useMemo(() => {
    const all = [...(stock.data ?? [])].sort((a, b) => a.available - b.available);
    return onlyBelow ? all.filter((r) => r.available <= threshold) : all;
  }, [stock.data, threshold, onlyBelow]);

  /** Los N con menor disponibilidad, ya ordenados ascendente. */
  const chartData = useMemo(
    () =>
      rows.slice(0, REPLENISH_TOP_N).map((r) => ({
        ...r,
        shortName: shortName(r.name),
        committed: r.committedInKits + r.committedInLoans,
      })),
    [rows],
  );

  /** Lista de compra: todo lo que está en o bajo el umbral. */
  const toBuy = useMemo(
    () => (stock.data ?? []).filter((r) => r.available <= threshold).sort((a, b) => a.available - b.available),
    [stock.data, threshold],
  );

  const barColor = (available: number) =>
    available <= 0 ? colors.danger : available <= threshold ? colors.ambar : colors.blue;

  const copyList = async () => {
    const text = toBuy
      .map((r) => `- ${r.name}${r.code ? ` (${r.code})` : ''}: ${r.available} disponible(s) de ${r.totalStock}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles (http, permisos denegados): no se rompe la vista.
      setCopied(false);
    }
  };

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-text-primary">Componentes por reponer</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Los {REPLENISH_TOP_N} con menor disponibilidad, de menor a mayor. Se considera
            stock bajo con <strong className="text-text-primary">{threshold} o menos</strong>{' '}
            disponibles.
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-end gap-x-4 gap-y-2">
          <ThresholdControl value={threshold} onChange={setThreshold} />
          <Checkbox
            checked={onlyBelow}
            onChange={(e) => setOnlyBelow(e.target.checked)}
            label="Solo bajo el umbral"
          />
        </div>
      </div>

      {stock.isLoading ? (
        <Loading />
      ) : stock.isError ? (
        <ErrorState message={getApiErrorMessage(stock.error)} />
      ) : chartData.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-success/30 bg-success/10 px-4 py-6 text-center text-sm font-semibold text-success">
          Ningún componente está en o bajo el umbral de {threshold}. ✅
        </p>
      ) : (
        <>
          {/* Scroll horizontal propio: con muchas columnas el eje X necesita ancho. */}
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface-card p-4">
            <div style={{ minWidth: chartData.length * COLUMN_WIDTH, height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 11, fill: colors.textSecondary }}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: colors.textSecondary }}
                    allowDecimals={false}
                  />
                  <Tooltip cursor={{ fill: `${colors.sky}22` }} content={<StockTooltip />} />
                  {/* `minPointSize`: sin esto una disponibilidad de 0 dibuja una barra
                      de altura cero y el componente MÁS crítico sería el único invisible. */}
                  <Bar
                    dataKey="available"
                    name="Disponible"
                    radius={[4, 4, 0, 0]}
                    minPointSize={3}
                  >
                    {chartData.map((r) => (
                      <Cell key={r.id} fill={barColor(r.available)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <Legend threshold={threshold} colors={colors} />

          <div className="mt-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-text-primary">
                Lista de reposición{' '}
                <span className="font-normal text-text-secondary">
                  ({toBuy.length} con ≤ {threshold} disponibles)
                </span>
              </h3>
              {toBuy.length > 0 && (
                <Button size="sm" variant="secondary" onClick={() => void copyList()}>
                  {copied ? '¡Copiado!' : 'Copiar lista'}
                </Button>
              )}
            </div>

            {toBuy.length === 0 ? (
              <p className="rounded-[var(--radius-card)] border border-border bg-surface-card p-6 text-center text-sm text-text-muted">
                Nada por reponer con este umbral.
              </p>
            ) : (
              <ReplenishList rows={toBuy} />
            )}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Umbral libre: input numérico + accesos rápidos. Solo se propaga al store cuando
 * el valor es válido, así que un campo vacío o fuera de rango nunca deja el gráfico
 * sin colorear: sigue vigente el último umbral bueno y se muestra un hint.
 */
function ThresholdControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  // Borrador local: permite dejar el campo vacío mientras se escribe.
  const [draft, setDraft] = useState(String(value));
  const parsed = Number(draft);
  const invalid = draft.trim() === '' || !isValidThreshold(parsed);

  const apply = (raw: string) => {
    setDraft(raw);
    const n = Number(raw);
    if (raw.trim() !== '' && isValidThreshold(n)) onChange(n);
  };

  const applyPreset = (n: number) => {
    setDraft(String(n));
    onChange(n);
  };

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-end gap-2">
        <Input
          label="Umbral bajo"
          type="number"
          min={0}
          max={MAX_THRESHOLD}
          className="w-24"
          invalid={invalid}
          value={draft}
          onChange={(e) => apply(e.target.value)}
          // Al salir del campo se restaura el último valor válido.
          onBlur={() => setDraft(String(value))}
          aria-describedby="threshold-hint"
        />
        <div className="flex shrink-0 flex-wrap gap-1">
          {THRESHOLD_PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => applyPreset(n)}
              aria-pressed={value === n}
              className={`min-h-[36px] rounded-full border px-3 text-xs font-semibold transition-colors ${
                value === n
                  ? 'border-primary bg-primary text-text-on-primary'
                  : 'border-border bg-surface-card text-text-secondary hover:border-primary'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <p id="threshold-hint" className={`text-xs ${invalid ? 'text-danger' : 'text-text-muted'}`}>
        {invalid
          ? `Valor inválido; se sigue usando ${value}. Escribe un entero entre 0 y ${MAX_THRESHOLD}.`
          : `Entero entre 0 y ${MAX_THRESHOLD}.`}
      </p>
    </div>
  );
}

function Legend({
  threshold,
  colors,
}: {
  threshold: number;
  colors: ReturnType<typeof useUcnColors>;
}) {
  const items = [
    { color: colors.danger, label: 'Sin stock (0)' },
    { color: colors.ambar, label: `Bajo (≤ ${threshold})` },
    { color: colors.blue, label: 'Suficiente' },
  ];
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-xs text-text-secondary">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: i.color }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

interface TooltipPayload {
  payload: StockRow & { committed: number };
}

/** Tooltip del theme: total / en kits / en préstamos / disponible. */
function StockTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="max-w-[16rem] rounded-[var(--radius)] border border-border bg-surface-card p-3 text-xs shadow-lg">
      <p className="break-words font-bold text-text-primary">
        {row.name}
        {row.code && <span className="ml-1 font-mono text-text-secondary">{row.code}</span>}
      </p>
      <dl className="mt-1.5 flex flex-col gap-0.5">
        <TooltipRow label="Total" value={row.totalStock} />
        <TooltipRow label="En kits" value={row.committedInKits} />
        <TooltipRow label="En préstamos" value={row.committedInLoans} />
        <TooltipRow
          label="Disponible"
          value={row.available}
          className={row.available <= 0 ? 'text-danger' : 'text-text-primary'}
        />
      </dl>
    </div>
  );
}

function TooltipRow({
  label,
  value,
  className = 'text-text-primary',
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-text-secondary">{label}</dt>
      <dd className={`font-semibold ${className}`}>{value}</dd>
    </div>
  );
}

/** Tarjetas en móvil, tabla desde `sm`: pensada para salir a comprar. */
function ReplenishList({ rows }: { rows: StockRow[] }) {
  const availability = (r: StockRow) => (
    <span className={`font-bold ${r.available <= 0 ? 'text-danger' : 'text-ocre'}`}>
      {r.available}
    </span>
  );

  return (
    <>
      <div className="flex flex-col gap-2 sm:hidden">
        {rows.map((r) => (
          <div
            key={r.id}
            className="min-w-0 rounded-[var(--radius-card)] border border-border bg-surface-card p-3"
          >
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-semibold text-text-primary">{r.name}</p>
                {r.code && (
                  <p className="font-mono text-xs text-text-secondary">{r.code}</p>
                )}
              </div>
              <span className="shrink-0 text-sm">{availability(r)} disp.</span>
            </div>
            <TagBadgeList tags={r.tags} className="mt-1.5" />
            <p className="mt-1.5 text-xs text-text-secondary">
              Total {r.totalStock} · comprometido {r.committedInKits + r.committedInLoans}
            </p>
          </div>
        ))}
      </div>

      <div className="hidden sm:block">
        <Table>
          <thead>
            <tr>
              <Th>Componente</Th>
              <Th>Etiquetas</Th>
              <Th>Total</Th>
              <Th>Comprometido</Th>
              <Th>Disponible</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.available <= 0 ? 'bg-danger/5' : undefined}>
                <Td>
                  <span className="font-semibold">{r.name}</span>
                  {r.code && (
                    <span className="ml-2 inline-block whitespace-nowrap rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                      {r.code}
                    </span>
                  )}
                </Td>
                <Td>
                  {r.tags.length > 0 ? (
                    <TagBadgeList tags={r.tags} />
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </Td>
                <Td>{r.totalStock}</Td>
                <Td>{r.committedInKits + r.committedInLoans}</Td>
                <Td>{availability(r)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}

// --- c) Uso ---

function UsageSection({ period }: { period: Period }) {
  const usage = useUsage(period);
  const colors = useUcnColors();

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-semibold text-text-primary">Componentes más usados</h2>
      {usage.isLoading ? (
        <Loading />
      ) : usage.isError ? (
        <ErrorState message={getApiErrorMessage(usage.error)} />
      ) : usage.data && usage.data.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface-card p-4">
          <div style={{ minWidth: usage.data.length * COLUMN_WIDTH, height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={usage.data.map((u) => ({ ...u, shortName: shortName(u.name) }))}
                margin={{ top: 8, right: 8, left: -16, bottom: 48 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
                <XAxis
                  dataKey="shortName"
                  tick={{ fontSize: 11, fill: colors.textSecondary }}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={56}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: colors.textSecondary }}
                  allowDecimals={false}
                />
                <Tooltip cursor={{ fill: `${colors.sky}22` }} content={<UsageTooltip />} />
                <Bar
                  dataKey="totalUsed"
                  fill={colors.ambar}
                  name="Unidades usadas"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-muted">Sin uso registrado en este periodo.</p>
      )}
    </section>
  );
}

// --- d) Devoluciones pendientes ---

function PendingReturnsSection({ period }: { period: Period }) {
  const pending = usePendingReturns(period);

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-semibold text-text-primary">Devoluciones pendientes</h2>
      {pending.isLoading ? (
        <Loading />
      ) : pending.isError ? (
        <ErrorState message={getApiErrorMessage(pending.error)} />
      ) : pending.data && pending.data.length > 0 ? (
        <div className="flex flex-col gap-4">
          {pending.data.map((c) => (
            <div
              key={c.course.id}
              className="rounded-[var(--radius-card)] border border-border bg-surface-card p-4"
            >
              <div className="mb-2 font-semibold text-text-primary">
                {c.course.name}{' '}
                <span className="text-text-secondary">
                  · {c.course.year}/{c.course.semester === 1 ? '01' : '02'}
                </span>
              </div>
              <Table>
                <thead>
                  <tr>
                    <Th>Grupo</Th>
                    <Th>Ítems de kit</Th>
                    <Th>Préstamos</Th>
                    <Th>Unidades pend.</Th>
                  </tr>
                </thead>
                <tbody>
                  {c.groups.map((g) => (
                    <tr key={g.groupId}>
                      <Td className="font-semibold">{g.groupName}</Td>
                      <Td>{g.pendingKitItems}</Td>
                      <Td>{g.pendingLoans}</Td>
                      <Td>
                        <Badge tone="ambar">{g.totalPendingUnits}</Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-success/30 bg-success/10 px-4 py-6 text-center text-sm font-semibold text-success">
          Todo devuelto ✅
        </div>
      )}
    </section>
  );
}

interface UsageTooltipPayload {
  payload: UsageRow;
}

/** Tooltip de uso: total y desglose entre kits y préstamos. */
function UsageTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: UsageTooltipPayload[];
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="max-w-[16rem] rounded-[var(--radius)] border border-border bg-surface-card p-3 text-xs shadow-lg">
      <p className="break-words font-bold text-text-primary">{row.name}</p>
      <dl className="mt-1.5 flex flex-col gap-0.5">
        <TooltipRow label="En kits" value={row.inKits} />
        <TooltipRow label="En préstamos" value={row.inLoans} />
        <TooltipRow label="Total usado" value={row.totalUsed} />
      </dl>
    </div>
  );
}
