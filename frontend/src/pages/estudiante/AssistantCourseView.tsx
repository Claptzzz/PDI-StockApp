import { Link } from 'react-router-dom';
import { useGroups } from '@/api/groups';
import { getApiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { MatchedMembers } from '@/components/ui/MatchedMembers';
import { Table, Td, Th } from '@/components/ui/Table';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States';
import { useGroupSearch } from '@/hooks/useGroupSearch';

/**
 * Vista de OPERACIÓN de un ayudante: grupos del curso en SOLO LECTURA (sin crear /
 * renombrar / borrar / importar / gestionar miembros). Cada fila enlaza al detalle
 * del grupo, que vive en su propia ruta para permitir deep-linking y "volver".
 */
export function AssistantCourseView({ courseId }: { courseId: string }) {
  const groups = useGroups(courseId);
  // Mismo hook de búsqueda que usa el profesor en /profesor/cursos/:courseId.
  const search = useGroupSearch(groups.data);

  if (groups.isLoading) return <Loading />;
  if (groups.isError) return <ErrorState message={getApiErrorMessage(groups.error)} />;
  if (!groups.data || groups.data.length === 0) {
    return <EmptyState message="Este curso aún no tiene grupos." />;
  }

  return (
    <div>
      <SearchBar
        value={search.query}
        onValueChange={search.setQuery}
        placeholder="Buscar equipo por nombre o integrante…"
        hint={search.hint}
        aria-label="Buscar equipo"
      />

      {search.matches.length === 0 ? (
        <div className="mt-4">
          <EmptyState message="Ningún equipo coincide con la búsqueda." />
        </div>
      ) : (
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Grupo</Th>
                <Th>Integrantes</Th>
                <Th className="text-right">Acción</Th>
              </tr>
            </thead>
            <tbody>
              {search.matches.map(({ group: g, matchedMembers }) => (
                <tr key={g.id}>
                  <Td>
                    <span className="font-semibold">{g.name}</span>
                    <MatchedMembers members={matchedMembers} />
                  </Td>
                  <Td>{g.membersCount}</Td>
                  <Td className="text-right">
                    <Link to={`/estudiante/cursos/${courseId}/grupos/${g.id}`}>
                      <Button size="sm" variant="secondary">
                        Operar
                      </Button>
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
