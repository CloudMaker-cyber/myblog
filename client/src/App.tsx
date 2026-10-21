import { Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from './components/ProtectedRoute';
import { SiteLayout } from './components/layout/SiteLayout';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MyArticlesPage } from './pages/MyArticlesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RegisterPage } from './pages/RegisterPage';
import { WritePage } from './pages/WritePage';

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        <Route
          path="write"
          element={
            <ProtectedRoute>
              <WritePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="articles/:id/edit"
          element={
            <ProtectedRoute>
              <WritePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="me/articles"
          element={
            <ProtectedRoute>
              <MyArticlesPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
