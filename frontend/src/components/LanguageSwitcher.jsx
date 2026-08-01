// cypod-telemetry
import React from 'react';
import { useI18n } from '../i18n/index.jsx';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="lang-switcher" role="group" aria-label="Language">
      <button className={locale === 'en' ? 'lang-btn active' : 'lang-btn'} onClick={() => setLocale('en')}>
        EN
      </button>
      <button className={locale === 'ar' ? 'lang-btn active' : 'lang-btn'} onClick={() => setLocale('ar')}>
        عربي
      </button>
    </div>
  );
}
