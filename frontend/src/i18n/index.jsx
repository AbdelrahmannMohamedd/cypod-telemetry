// cypod-telemetry
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import en from './en.json';
import ar from './ar.json';

const DICTS = { en, ar };
const I18nContext = createContext(null);

const STORAGE_KEY = 'cypod-locale';

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(() => localStorage.getItem(STORAGE_KEY) || 'en');
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.setAttribute('lang', locale);
    document.documentElement.setAttribute('dir', dir);
  }, [locale, dir]);

  const t = useMemo(() => {
    const dict = DICTS[locale] || DICTS.en;
    return (key) => dict[key] || DICTS.en[key] || key;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, dir, t }), [locale, dir, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
