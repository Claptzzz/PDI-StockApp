import { useMemo, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTerms } from '@/api/courses';
import { useOverview, useStock, useUsage, usePendingReturns, type Period } from '@/api/metrics';
import { getApiErrorMessage } from '@/lib/errors';
import type { StockRow } from '@/lib/apiTypes';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Table, Td, Th } from '@/components/ui/Table';
import { Loading, ErrorState } from '@/components/ui/States';

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
      <StockSection />
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

// --- b) Bodega / stock (global) ---

function StockSection() {
  const stock = useStock();
  const colors = useUcnColors();

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-semibold text-text-primary">Bodega (stock global)</h2>
      {stock.isLoading ? (
        <Loading />
      ) : stock.isError ? (
        <ErrorState message={getApiErrorMessage(stock.error)} />
      ) : stock.data && stock.data.length > 0 ? (
        <>
          <div
            className="rounded-[var(--radius-card)] border border-border bg-surface-card p-4"
            style={{ height: Math.max(220, stock.data.length * 34) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stock.data} layout="vertical" margin={{ left: 20, right: 16 }}>
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tick={{ fontSize: 12 }}
                  interval={0}
                />
                <Tooltip />
                <Bar dataKey="committedInKits" stackId="a" fill={colors.navy} name="En kits" />
                <Bar
                  dataKey="committedInLoans"
                  stackId="a"
                  fill={colors.blue}
                  name="En préstamos"
                />
                <Bar dataKey="available" stackId="a" name="Disponible">
                  {stock.data.map((s: StockRow) => (
                    <Cell key={s.id} fill={s.lowStock ? colors.danger : colors.sky} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Componente</Th>
                  <Th>Total</Th>
                  <Th>En kits</Th>
                  <Th>En préstamos</Th>
                  <Th>Disponible</Th>
                </tr>
              </thead>
              <tbody>
                {stock.data.map((s) => (
                  <tr key={s.id} className={s.lowStock ? 'bg-danger/5' : undefined}>
                    <Td className="font-semibold">
                      {s.name} {s.lowStock && <Badge tone="danger">Bajo stock</Badge>}
                    </Td>
                    <Td>{s.totalStock}</Td>
                    <Td>{s.committedInKits}</Td>
                    <Td>{s.committedInLoans}</Td>
                    <Td>
                      <span className={s.lowStock ? 'font-semibold text-danger' : 'text-success'}>
                        {s.available}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </>
      ) : (
        <p className="text-sm text-text-muted">No hay componentes en bodega.</p>
      )}
    </section>
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
        <div
          className="rounded-[var(--radius-card)] border border-border bg-surface-card p-4"
          style={{ height: Math.max(220, usage.data.length * 34) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={usage.data} layout="vertical" margin={{ left: 20, right: 16 }}>
              <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={150}
                tick={{ fontSize: 12 }}
                interval={0}
              />
              <Tooltip />
              <Bar
                dataKey="totalUsed"
                fill={colors.ambar}
                name="Unidades usadas"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
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
