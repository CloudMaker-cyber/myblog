import { Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from './components/ProtectedRoute';
import { SiteLayout } from './components/layout/SiteLayout';
import { ArticleDetailPage } from './pages/ArticleDetailPage';
import { ArticleListPage } from './pages/ArticleListPage';
import { AuthorPage } from './pages/AuthorPage';
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
        <Route path="tech" element={<ArticleListPage title="技术文章" type="tech" />} />
        <Route path="life" element={<ArticleListPage title="日常思考" type="life" />} />
        <Route path="articles/:id" element={<ArticleDetailPage />} />
        <Route path="users/:id" element={<AuthorPage />} />
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
