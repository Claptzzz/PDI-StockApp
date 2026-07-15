import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RoleRoute } from '@/components/RoleRoute';
import { Layout } from '@/components/Layout';
import Login from '@/pages/Login';
import { EstudianteDashboard, ProfesorDashboard } from '@/pages/Dashboards';
import { AccountsPage } from '@/pages/admin/AccountsPage';
import { CoursesPage } from '@/pages/admin/CoursesPage';
import { WarehousePage } from '@/pages/admin/WarehousePage';
import { useAuth } from '@/store/auth';
import { dashboardPath } from '@/lib/types';

function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? dashboardPath(user.role) : '/login'} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<RootRedirect />} />

          <Route path="/admin" element={<RoleRoute roles={['ADMIN']} />}>
            <Route index element={<Navigate to="/admin/cuentas" replace />} />
            <Route path="cuentas" element={<AccountsPage />} />
            <Route path="cursos" element={<CoursesPage />} />
            <Route path="bodega" element={<WarehousePage />} />
          </Route>

          <Route
            path="/profesor"
            element={
              <RoleRoute roles={['PROFESSOR']}>
                <ProfesorDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/estudiante"
            element={
              <RoleRoute roles={['STUDENT']}>
                <EstudianteDashboard />
              </RoleRoute>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
