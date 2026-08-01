// cypod-telemetry
import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';

export default function Alerts() {
  const { t, locale } = useI18n();
  const { token } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { alerts: list } = await api.listAlerts(token, locale);
        if (!cancelled) {
          setAlerts(list);
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError(err.message || t('common.error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const intervalId = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [token, locale, t]);

  if (loading) return <p className="page-status">{t('common.loading')}</p>;

  return (
    <div className="page">
      <h1>{t('alerts.title')}</h1>
      {error && <p className="form-error">{error}</p>}
      {alerts.length === 0 ? (
        <p className="page-status">{t('alerts.empty')}</p>
      ) : (
        <table className="alerts-table">
          <thead>
            <tr>
              <th>{t('alerts.device')}</th>
              <th>{t('alerts.type')}</th>
              <th>{t('alerts.message')}</th>
              <th>{t('alerts.triggeredAt')}</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id}>
                <td>{a.device_name}</td>
                <td>
                  <span className={`badge ${a.type === 'LOW_BATTERY' ? 'badge-warning' : 'badge-fault'}`}>{a.type}</span>
                </td>
                <td>{a.message}</td>
                <td>{new Date(a.triggered_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
