import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { PublicLayout } from './components/layout';
import { CatalogPage } from './pages/CatalogPage';
import { HomePage } from './pages/HomePage';
import { ProductPage } from './pages/ProductPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { DashboardPage } from './pages/admin/DashboardPage';
import { ImportPage } from './pages/admin/ImportPage';
import { LoginPage } from './pages/admin/LoginPage';
import { ProductFormPage } from './pages/admin/ProductFormPage';
import { ProductsPage } from './pages/admin/ProductsPage';
import { ReviewPage } from './pages/admin/ReviewPage';
import { TaxonomiesPage } from './pages/admin/TaxonomiesPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/catalogo" element={<CatalogPage />} />
            <Route path="/produto/:slug" element={<ProductPage />} />
          </Route>
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="produtos" element={<ProductsPage />} />
            <Route path="produtos/novo" element={<ProductFormPage />} />
            <Route path="produtos/:id" element={<ProductFormPage />} />
            <Route path="taxonomias" element={<TaxonomiesPage />} />
            <Route path="importacao" element={<ImportPage />} />
            <Route path="importacao/itens/:id" element={<ReviewPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
