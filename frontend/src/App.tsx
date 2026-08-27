import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RoleRoute } from '@/components/RoleRoute';
import { Layout } from '@/components/Layout';
import Login from '@/pages/Login';
import { AccountsPage } from '@/pages/admin/AccountsPage';
import { CoursesPage } from '@/pages/admin/CoursesPage';
import { WarehousePage } from '@/pages/admin/WarehousePage';
import { DocumentsPage } from '@/pages/admin/DocumentsPage';
import { MetricsPage } from '@/pages/admin/MetricsPage';
import { ProfesorCoursesPage } from '@/pages/profesor/CoursesPage';
import { CourseDetailPage } from '@/pages/profesor/CourseDetailPage';
import { GroupPage } from '@/pages/profesor/GroupPage';
import { StudentCoursesPage } from '@/pages/estudiante/StudentCoursesPage';
import { StudentCourseDetailPage } from '@/pages/estudiante/StudentCourseDetailPage';
import { AssistantGroupPage } from '@/pages/estudiante/AssistantGroupPage';
import { useAuth } from '@/store/auth';
import { dashboardPath, primaryRole, userRoles } from '@/lib/types';

function RootRedirect() {
  const { user } = useAuth();
  // Rol PRINCIPAL: con varios roles, entra por el de mayor privilegio.
  const home = primaryRole(userRoles(user));
  return <Navigate to={home ? dashboardPath(home) : '/login'} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<RootRedirect />} />

          <Route path="/admin" element={<RoleRoute roles={['ADMIN']} />}>
            <Route index element={<Navigate to="/admin/metricas" replace />} />
            <Route path="metricas" element={<MetricsPage />} />
            <Route path="cuentas" element={<AccountsPage />} />
            <Route path="cursos" element={<CoursesPage />} />
            <Route path="bodega" element={<WarehousePage />} />
            <Route path="documentos" element={<DocumentsPage />} />
          </Route>

          <Route path="/profesor" element={<RoleRoute roles={['PROFESSOR']} />}>
            <Route index element={<Navigate to="/profesor/cursos" replace />} />
            <Route path="cursos" element={<ProfesorCoursesPage />} />
            <Route path="cursos/:courseId" element={<CourseDetailPage />} />
            <Route path="cursos/:courseId/grupos/:groupId" element={<GroupPage />} />
          </Route>
          <Route path="/estudiante" element={<RoleRoute roles={['STUDENT']} />}>
            <Route index element={<StudentCoursesPage />} />
            <Route path="cursos/:courseId" element={<StudentCourseDetailPage />} />
            <Route
              path="cursos/:courseId/grupos/:groupId"
              element={<AssistantGroupPage />}
            />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
