// src/i18n/index.js

import en from './en.json';
import fr from './fr.json';

const translations = { en, fr };

export function getTranslations(locale = 'en') {
  return translations[locale] || translations.en;
}

export function t(locale, path) {
  const trans = getTranslations(locale);
  return path.split('.').reduce((obj, key) => obj?.[key], trans) || path;
}