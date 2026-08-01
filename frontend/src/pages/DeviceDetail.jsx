// cypod-telemetry
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';

export default function DeviceDetail() {
  const { id } = useParams();
  const { t, locale } = useI18n();
  const { token } = useAuth();

  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [latestRes, historyRes] = await Promise.all([
          api.getLatest(id, token, locale),
          api.getHistory(id, token, locale, { pageSize: 25 }),
        ]);
        if (cancelled) return;
        setLatest(latestRes.latest);
        setHistory(historyRes.items);
        setError('');
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
  }, [id, token, locale, t]);

  if (loading) return <p className="page-status">{t('common.loading')}</p>;

  return (
    <div className="page">
      <Link to="/devices" className="btn-link">
        &larr; {t('device.detail.back')}
      </Link>
      <h1>
        {t('device.detail.title')}: {id}
      </h1>
      {error && <p className="form-error">{error}</p>}

      {latest && (
        <dl className="device-stats device-stats-large">
          <div>
            <dt>{t('devices.battery')}</dt>
            <dd>{Number(latest.battery).toFixed(1)}%</dd>
          </div>
          <div>
            <dt>{t('devices.temperature')}</dt>
            <dd>{Number(latest.temperature).toFixed(1)}°C</dd>
          </div>
          <div>
            <dt>{t('devices.status')}</dt>
            <dd>{latest.status}</dd>
          </div>
          <div>
            <dt>{t('devices.lastSeen')}</dt>
            <dd>{new Date(latest.recorded_at).toLocaleString()}</dd>
          </div>
        </dl>
      )}

      <h2>{t('device.detail.recentHistory')}</h2>
      <ul className="history-list">
        {history.map((item, i) => (
          <li key={`${item.recorded_at}-${i}`}>
            <span className="history-time">{new Date(item.recorded_at).toLocaleString()}</span>
            <span>{Number(item.battery).toFixed(1)}%</span>
            <span>{Number(item.temperature).toFixed(1)}°C</span>
            <span className={`badge ${item.status === 'FAULT' ? 'badge-fault' : item.status === 'WARNING' ? 'badge-warning' : 'badge-ok'}`}>
              {item.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
