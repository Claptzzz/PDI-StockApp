export interface TabDef<T extends string> {
  id: T;
  label: string;
  /** Marcador opcional a la derecha del texto (p. ej. un contador o un punto). */
  badge?: string;
}

interface TabsProps<T extends string> {
  tabs: TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}

/**
 * Pestañas del theme UCN. La fila scrollea horizontalmente cuando no caben
 * (a 375px cuatro etiquetas no entran) sin desbordar la página.
 */
export function Tabs<T extends string>({ tabs, active, onChange, className = '' }: TabsProps<T>) {
  return (
    <div className={`-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 ${className}`}>
      <div role="tablist" className="flex w-max min-w-full gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => onChange(t.id)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              active === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
            {t.badge && (
              <span className="rounded-full bg-ambar/25 px-1.5 text-[10px] font-bold text-ocre">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
