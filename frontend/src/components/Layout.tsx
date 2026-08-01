import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { useMyContexts } from '@/api/student';
import { roleLabel, type Role } from '@/lib/types';
import { Toaster } from '@/components/ui/Toaster';
import ucnLogo from '@/assets/UCN_y_texto.png';

interface NavItem {
  label: string;
  to?: string;
}

const NAV_ITEMS: Record<Role, NavItem[]> = {
  ADMIN: [
    { label: 'Métricas', to: '/admin/metricas' },
    { label: 'Cuentas', to: '/admin/cuentas' },
    { label: 'Cursos', to: '/admin/cursos' },
    { label: 'Bodega', to: '/admin/bodega' },
  ],
  PROFESSOR: [{ label: 'Cursos', to: '/profesor/cursos' }],
  STUDENT: [{ label: 'Mi grupo', to: '/estudiante' }],
};

export function Layout() {
  const { user, logout } = useAuth();
  const contexts = useMyContexts(user?.role === 'STUDENT');
  const hasAssistant = (contexts.data ?? []).some((c) => c.hatType === 'ASSISTANT');

  const items: NavItem[] = !user
    ? []
    : user.role === 'STUDENT'
      ? [{ label: hasAssistant ? 'Mis cursos' : 'Mi grupo', to: '/estudiante' }]
      : NAV_ITEMS[user.role];

  const [drawerOpen, setDrawerOpen] = useState(false);

  // Bloquea scroll del body y cierra con Esc mientras el drawer está abierto.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen">
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy text-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-white/10 px-6 py-5 text-lg font-bold">Kits Arduino</div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) =>
            item.to ? (
              <NavLink
                key={item.label}
                to={item.to}
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center rounded-[var(--radius)] px-3 text-sm font-semibold transition-colors ${
                    isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ) : (
              <div
                key={item.label}
                className="flex min-h-[44px] items-center justify-between rounded-[var(--radius)] px-3 text-sm text-white/80"
              >
                <span>{item.label}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">
                  pronto
                </span>
              </div>
            ),
          )}
        </nav>
        <div className="border-t border-white/10 px-6 py-4 text-xs text-white/40">
          UCN · Escuela de Ingeniería
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-surface-card px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-[var(--radius)] text-text-secondary transition-colors hover:bg-gray-100 lg:hidden"
              aria-label="Abrir menú"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <img
              src={ucnLogo}
              alt="Universidad Católica del Norte"
              className="h-8 w-auto sm:h-10"
            />
          </div>

          <UserMenu
            name={user?.name ?? ''}
            role={user ? roleLabel[user.role] : ''}
            onLogout={logout}
          />
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <Toaster />
    </div>
  );
}

function UserMenu({ name, role, onLogout }: { name: string; role: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-[var(--radius)] py-1 pl-1 pr-1 transition-colors hover:bg-gray-100 sm:pr-2"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-text-on-primary">
          {initial}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[16ch] truncate text-sm font-semibold text-text-primary">
            {name}
          </span>
          <span className="block text-xs text-text-secondary">{role}</span>
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-56 rounded-[var(--radius)] border border-border bg-surface-card py-1 shadow-lg"
        >
          <div className="border-b border-border px-4 py-2 sm:hidden">
            <div className="text-sm font-semibold text-text-primary">{name}</div>
            <div className="text-xs text-text-secondary">{role}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex min-h-[44px] w-full items-center px-4 text-left text-sm font-semibold text-text-secondary transition-colors hover:bg-gray-100"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
