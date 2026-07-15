import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { roleLabel, type Role } from '@/lib/types';
import { Toaster } from '@/components/ui/Toaster';
import ucnLogo from '@/assets/UCN_y_texto.png';

interface NavItem {
  label: string;
  to?: string;
}

// ADMIN tiene enlaces reales; profesor/estudiante quedan como placeholders (Fase 4c/4d).
const NAV_ITEMS: Record<Role, NavItem[]> = {
  ADMIN: [
    { label: 'Cuentas', to: '/admin/cuentas' },
    { label: 'Cursos', to: '/admin/cursos' },
    { label: 'Bodega', to: '/admin/bodega' },
  ],
  PROFESSOR: [{ label: 'Cursos', to: '/profesor/cursos' }],
  STUDENT: [{ label: 'Mi grupo', to: '/estudiante' }],
};

export function Layout() {
  const { user, logout } = useAuth();
  const items = user ? NAV_ITEMS[user.role] : [];

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col bg-navy text-white">
        <div className="border-b border-white/10 px-6 py-5 text-lg font-bold">Kits Arduino</div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {items.map((item) =>
            item.to ? (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  `block rounded-[var(--radius)] px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ) : (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-[var(--radius)] px-3 py-2 text-sm text-white/80"
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

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface-card px-8 py-3">
          <img src={ucnLogo} alt="Universidad Católica del Norte" className="h-11 w-auto" />
          <div className="flex items-center gap-4">
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold text-text-primary">{user?.name}</div>
              <div className="text-xs text-text-secondary">{user ? roleLabel[user.role] : ''}</div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-[var(--radius)] border border-border px-3 py-1.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-gray-100"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>

      <Toaster />
    </div>
  );
}
