import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useComponents } from '@/api/components';
import { useTags } from '@/api/tags';
import { useDebounced } from '@/hooks/useDebounced';
import type { Component } from '@/lib/apiTypes';
import { normalizeHex, tagStyles } from '@/lib/tagColor';
import { TagBadgeList } from './TagBadge';

/** Tope del catálogo que se trae al abrir sin escribir. */
const CATALOG_LIMIT = 50;

/** Bajo este ancho el panel se ancla al viewport, no al campo. */
const NARROW_VIEWPORT = 640;
/** Ancho mínimo legible: nombre + código + etiquetas + disponibilidad. */
const MIN_PANEL_WIDTH = 280;
/** Espacio bajo el campo que basta para ver varias opciones sin voltear el panel. */
const COMFORTABLE_SPACE = 280;
const MARGIN = 8;

interface PanelBox {
  placement: 'below' | 'above';
  /** Distancia al borde superior (below) o inferior (above) del viewport. */
  y: number;
  left: number;
  width: number;
  maxHeight: number;
}

/**
 * Coloca el panel respecto al campo. Dos ajustes que importan en móvil:
 * el campo puede ser muy angosto (comparte fila con la cantidad), así que en
 * pantallas pequeñas el panel toma el ancho del viewport; y si el campo quedó
 * cerca del borde inferior, se abre hacia arriba en vez de dejar una rendija.
 */
function computePanelBox(r: DOMRect): PanelBox {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const width =
    vw < NARROW_VIEWPORT
      ? vw - MARGIN * 2
      : Math.min(Math.max(r.width, MIN_PANEL_WIDTH), vw - MARGIN * 2);

  // Se alinea al campo, pero sin salirse por ningún borde.
  const left = Math.max(MARGIN, Math.min(r.left, vw - width - MARGIN));

  const spaceBelow = vh - r.bottom - MARGIN;
  const spaceAbove = r.top - MARGIN;
  // Abajo por defecto, salvo que quede estrecho Y arriba haya claramente más sitio
  // (típico del modal móvil, anclado a la parte baja de la pantalla).
  const below = spaceBelow >= COMFORTABLE_SPACE || spaceBelow >= spaceAbove;

  return below
    ? { placement: 'below', y: r.bottom + 4, left, width, maxHeight: spaceBelow - 4 }
    : { placement: 'above', y: vh - r.top + 4, left, width, maxHeight: spaceAbove - 4 };
}

interface ComponentComboboxProps {
  /** Texto visible en el input. */
  value: string;
  label?: string;
  placeholder?: string;
  /** Cambio de texto libre. Solo se emite cuando `allowFreeText` está activo. */
  onChange?: (text: string) => void;
  /** Se eligió un componente del catálogo. */
  onPick: (component: Component) => void;
  /**
   * Si es true (préstamos), lo escrito vale aunque no esté en el catálogo.
   * Si es false (plantillas, asignar kit), el input solo filtra: el valor
   * mostrado siempre proviene de una opción elegida.
   */
  allowFreeText?: boolean;
  /** Ids ya usados en la misma lista; se muestran deshabilitados. */
  excludeIds?: string[];
  invalid?: boolean;
  disabled?: boolean;
}

/**
 * Selector de componentes con desplegable completo.
 *
 * Al enfocar abre el catálogo (sin exigir escribir); al teclear filtra por nombre
 * o código contra `GET /components?search=`. Los chips de la cabecera acotan por
 * etiqueta, útil cuando el catálogo es grande.
 */
export function ComponentCombobox({
  value,
  label,
  placeholder,
  onChange,
  onPick,
  allowFreeText = true,
  excludeIds = [],
  invalid = false,
  disabled = false,
}: ComponentComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [tagIds, setTagIds] = useState<string[]>([]);
  /**
   * En modo catálogo el input no es del padre: mientras el desplegable está
   * abierto se escribe aquí para filtrar, y al cerrar sin elegir se restaura
   * `value` (el nombre del componente ya seleccionado).
   */
  const [draft, setDraft] = useState('');

  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  /** Caja del panel; se calcula porque va en un portal fuera del flujo. */
  const [box, setBox] = useState<PanelBox | null>(null);

  const text = allowFreeText ? value : open ? draft : value;
  const debounced = useDebounced(text.trim(), 300);

  const close = () => {
    setOpen(false);
    setHighlight(-1);
  };

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      // El panel vive en un portal: hay que comprobarlo aparte del campo.
      if (ref.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  /**
   * El panel se monta en un portal sobre <body> porque los tres usos viven dentro
   * de un Modal con `overflow-y-auto`, que recortaría un desplegable absoluto.
   * Como queda fuera del flujo, su posición se mide y se reajusta al hacer scroll
   * o redimensionar.
   */
  const measure = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    setBox(computePanelBox(el.getBoundingClientRect()));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    // `capture: true` para enterarse también del scroll interno del modal.
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open, measure]);

  // Sin búsqueda se pide el catálogo acotado; con búsqueda, el servidor filtra.
  const query = useComponents({
    search: debounced,
    tagIds,
    limit: debounced ? undefined : CATALOG_LIMIT,
    enabled: open,
  });
  const tagsQuery = useTags(open);

  const options = useMemo(() => query.data ?? [], [query.data]);
  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  /** Índices navegables con teclado (se saltan los ya usados). */
  const selectable = useMemo(
    () => options.map((c, i) => (excluded.has(c.id) ? -1 : i)).filter((i) => i >= 0),
    [options, excluded],
  );

  const openDropdown = () => {
    if (disabled) return;
    if (!allowFreeText) setDraft('');
    setOpen(true);
    setHighlight(-1);
  };

  const pick = (c: Component) => {
    if (excluded.has(c.id)) return;
    onPick(c);
    close();
  };

  const move = (delta: number) => {
    if (selectable.length === 0) return;
    const pos = selectable.indexOf(highlight);
    const next = pos < 0 ? (delta > 0 ? 0 : selectable.length - 1) : pos + delta;
    const clamped = Math.max(0, Math.min(selectable.length - 1, next));
    const idx = selectable[clamped];
    setHighlight(idx);
    listRef.current
      ?.querySelector(`[data-idx="${idx}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openDropdown();
      else move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      if (highlight >= 0 && options[highlight]) {
        e.preventDefault();
        pick(options[highlight]);
      }
    } else if (e.key === 'Escape') {
      if (!open) return;
      e.preventDefault();
      // El Modal cierra con Esc escuchando en document: sin frenar la propagación,
      // cerrar el desplegable cerraría también el formulario que lo contiene.
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close();
    }
  };

  const toggleTag = (id: string) => {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
    setHighlight(-1);
  };

  return (
    <div ref={ref} className="relative flex min-w-0 flex-col gap-1">
      {label && <span className="text-sm font-semibold text-text-secondary">{label}</span>}

      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          if (allowFreeText) onChange?.(e.target.value);
          else setDraft(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={openDropdown}
        onClick={openDropdown}
        onKeyDown={onKeyDown}
        className={`min-h-[44px] w-full rounded-[var(--radius)] border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-60 ${
          invalid ? 'border-danger' : 'border-border'
        }`}
      />

      {open && box && createPortal(
        <div
          ref={panelRef}
          style={{
            ...(box.placement === 'below' ? { top: box.y } : { bottom: box.y }),
            left: box.left,
            width: box.width,
            maxHeight: box.maxHeight,
          }}
          className="fixed z-[60] flex flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-surface-card shadow-lg"
        >
          {(tagsQuery.data ?? []).length > 0 && (
            <div className="flex shrink-0 flex-wrap gap-1 border-b border-border p-2">
              {(tagsQuery.data ?? []).map((tag) => {
                const active = tagIds.includes(tag.id);
                const hex = normalizeHex(tag.color);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={active}
                    // `onMouseDown` + preventDefault: el blur del input cerraría
                    // el panel antes de que llegue el click.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      toggleTag(tag.id);
                    }}
                    style={
                      active
                        ? { backgroundColor: hex, borderColor: hex, color: '#ffffff' }
                        : tagStyles(tag.color)
                    }
                    className="max-w-full truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                  >
                    {tag.name}
                  </button>
                );
              })}
              {tagIds.length > 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setTagIds([]);
                  }}
                  className="px-2 py-0.5 text-[11px] font-semibold text-primary underline"
                >
                  Limpiar
                </button>
              )}
            </div>
          )}

          <ul ref={listRef} role="listbox" className="min-h-0 flex-1 overflow-y-auto py-1">
            {query.isLoading ? (
              <li className="px-3 py-2 text-sm text-text-muted">Cargando catálogo…</li>
            ) : options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-text-muted">
                {allowFreeText
                  ? 'Sin coincidencias — puedes usar texto libre.'
                  : 'Sin coincidencias en el catálogo.'}
              </li>
            ) : (
              options.map((c, idx) => {
                const used = excluded.has(c.id);
                return (
                  <li
                    key={c.id}
                    data-idx={idx}
                    role="option"
                    aria-selected={highlight === idx}
                    aria-disabled={used || undefined}
                    onMouseEnter={() => !used && setHighlight(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(c);
                    }}
                    className={`flex min-w-0 items-start justify-between gap-3 px-3 py-2 text-sm ${
                      used
                        ? 'cursor-not-allowed opacity-50'
                        : `cursor-pointer ${highlight === idx ? 'bg-sky/20' : 'hover:bg-sky/10'}`
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                        <span className="break-words font-semibold text-text-primary">
                          {c.name}
                        </span>
                        {c.code && (
                          <span className="whitespace-nowrap rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                            {c.code}
                          </span>
                        )}
                        {used && (
                          <span className="text-xs font-semibold text-text-muted">
                            ya agregado
                          </span>
                        )}
                      </div>
                      <TagBadgeList tags={c.tags} className="mt-1" />
                    </div>
                    <AvailabilityTag available={c.available} />
                  </li>
                );
              })
            )}
          </ul>

          {query.isFetching && !query.isLoading && (
            <div className="shrink-0 border-t border-border px-3 py-1 text-xs text-text-muted">
              Buscando…
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

/** Disponibilidad: verde si sobra, ámbar si queda poco, rojo si es 0. */
function AvailabilityTag({ available }: { available: number }) {
  const tone =
    available <= 0
      ? 'bg-danger/10 text-danger'
      : available <= 5
        ? 'bg-ambar/20 text-ocre'
        : 'bg-success/10 text-success';
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      {available} disp.
    </span>
  );
}
