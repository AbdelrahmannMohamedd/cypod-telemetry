// cypod-telemetry
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';

export default function NavBar() {
  const { t } = useI18n();
  const { email, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="nav">
      <div className="nav-left">
        <span className="brand">{t('appName')}</span>
        <Link to="/devices">{t('nav.devices')}</Link>
        <Link to="/alerts">{t('nav.alerts')}</Link>
      </div>
      <div className="nav-right">
        {email && <span className="nav-email">{email}</span>}
        <LanguageSwitcher />
        <button className="btn-secondary" onClick={handleLogout}>
          {t('nav.logout')}
        </button>
      </div>
    </header>
  );
}
