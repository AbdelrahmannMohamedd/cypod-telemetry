// cypod-telemetry
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';

export default function Login() {
  const { t, locale } = useI18n();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'register') {
        await api.register(email, password, locale);
      }
      const { token } = await api.login(email, password, locale);
      login(token, email);
      navigate('/devices');
    } catch (err) {
      setError(err.message || t('login.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-top">
          <span className="brand">{t('appName')}</span>
          <LanguageSwitcher />
        </div>
        <h1>{mode === 'login' ? t('login.title') : t('login.registerTitle')}</h1>

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">{t('login.email')}</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />

          <label htmlFor="password">{t('login.password')}</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="form-error">{error}</p>}

          <button className="btn-primary" type="submit" disabled={submitting}>
            {mode === 'login' ? t('login.submit') : t('login.registerSubmit')}
          </button>
        </form>

        <button className="btn-link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? t('login.registerInstead') : t('login.loginInstead')}
        </button>
      </div>
    </div>
  );
}
