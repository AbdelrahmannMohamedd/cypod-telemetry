// cypod-telemetry
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { I18nProvider } from './i18n/index.jsx';
import NavBar from './components/NavBar.jsx';
import Login from './pages/Login.jsx';
import Devices from './pages/Devices.jsx';
import DeviceDetail from './pages/DeviceDetail.jsx';
import Alerts from './pages/Alerts.jsx';

function ProtectedLayout() {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return (
    <>
      <NavBar />
      <main className="content">
        <Outlet />
      </main>
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/devices" element={<Devices />} />
        <Route path="/devices/:id" element={<DeviceDetail />} />
        <Route path="/alerts" element={<Alerts />} />
      </Route>
      <Route path="*" element={<Navigate to="/devices" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}
