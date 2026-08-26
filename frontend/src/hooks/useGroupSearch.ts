import { useMemo, useState } from 'react';
import { useDebounced } from './useDebounced';
import type { Group, Member } from '@/lib/apiTypes';
import { normalizeForSearch } from '@/lib/textSearch';

export interface GroupMatch {
  group: Group;
  /** Integrantes que coincidieron; vacío si el match fue por el nombre del grupo. */
  matchedMembers: Member[];
}

export interface GroupSearch {
  query: string;
  setQuery: (value: string) => void;
  /** Grupos filtrados (todos si la búsqueda está vacía). */
  matches: GroupMatch[];
  total: number;
  active: boolean;
  /** "3 de 12 equipos" — listo para el hint de la SearchBar. */
  hint: string;
}

/**
 * Filtra los grupos YA CARGADOS por nombre del grupo o por nombre/correo de sus
 * integrantes. Es client-side a propósito: `GET /courses/:id/groups` ya trae los
 * integrantes, así que no hace falta ir al servidor por cada tecla.
 */
export function useGroupSearch(groups: Group[] | undefined, delay = 200): GroupSearch {
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, delay);

  const list = useMemo(() => groups ?? [], [groups]);

  const matches = useMemo<GroupMatch[]>(() => {
    const needle = normalizeForSearch(debounced.trim());
    if (!needle) return list.map((group) => ({ group, matchedMembers: [] }));

    return list.flatMap((group) => {
      const byName = normalizeForSearch(group.name).includes(needle);
      const matchedMembers = group.members.filter(
        (m) =>
          normalizeForSearch(m.name).includes(needle) ||
          normalizeForSearch(m.email).includes(needle),
      );
      if (!byName && matchedMembers.length === 0) return [];
      return [{ group, matchedMembers }];
    });
  }, [list, debounced]);

  const total = list.length;
  const active = debounced.trim().length > 0;

  return {
    query,
    setQuery,
    matches,
    total,
    active,
    hint: active ? `${matches.length} de ${total} equipos` : `${total} equipo(s)`,
  };
}
