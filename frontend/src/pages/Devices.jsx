// cypod-telemetry
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useAuth as useAuthContext } from '../context/AuthContext.jsx';
import { api } from '../api.js';

const POLL_INTERVAL_MS = 5000;

function StatusBadge({ status }) {
  const cls = status === 'FAULT' ? 'badge badge-fault' : status === 'WARNING' ? 'badge badge-warning' : 'badge badge-ok';
  return <span className={cls}>{status}</span>;
}

export default function Devices() {
  const { t } = useI18n();
  const { token, locale } = useAuthAndLocale();
  const [devices, setDevices] = useState([]);
  const [latestByDevice, setLatestByDevice] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const { devices: list } = await api.listDevices(token, locale);
      setDevices(list);

      const entries = await Promise.all(
        list.map(async (d) => {
          try {
            const { latest } = await api.getLatest(d.id, token, locale);
            return [d.id, latest];
          } catch {
            return [d.id, null];
          }
        }),
      );
      setLatestByDevice(Object.fromEntries(entries));
      setError('');
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [token, locale, t]);

  useEffect(() => {
    refresh();
    // Device list polls every ~5s for latest status, per spec.
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  if (loading) return <p className="page-status">{t('common.loading')}</p>;

  return (
    <div className="page">
      <h1>{t('devices.title')}</h1>
      {error && <p className="form-error">{error}</p>}
      {devices.length === 0 ? (
        <p className="page-status">{t('devices.empty')}</p>
      ) : (
        <div className="device-grid">
          {devices.map((d) => {
            const latest = latestByDevice[d.id];
            return (
              <Link to={`/devices/${d.id}`} key={d.id} className="device-card">
                <div className="device-card-head">
                  <h2>{d.name}</h2>
                  {latest && <StatusBadge status={latest.status} />}
                </div>
                {latest ? (
                  <dl className="device-stats">
                    <div>
                      <dt>{t('devices.battery')}</dt>
                      <dd>{Number(latest.battery).toFixed(1)}%</dd>
                    </div>
                    <div>
                      <dt>{t('devices.temperature')}</dt>
                      <dd>{Number(latest.temperature).toFixed(1)}°C</dd>
                    </div>
                    <div>
                      <dt>{t('devices.lastSeen')}</dt>
                      <dd>{new Date(latest.recorded_at).toLocaleString()}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="device-no-data">{t('devices.noData')}</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Small local hook combining the two contexts this page needs.
function useAuthAndLocale() {
  const { token } = useAuthContext();
  const { locale } = useI18n();
  return { token, locale };
}
