export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return <div className="py-10 text-center text-sm text-text-muted">{label}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      {message}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="py-10 text-center text-sm text-text-muted">{message}</div>;
}
