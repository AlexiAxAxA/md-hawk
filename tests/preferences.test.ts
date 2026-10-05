import { afterEach, describe, it, expect } from 'vitest';
import { catalogues, english, setLanguage, t } from '../src/i18n';
import { languages, defaultSettings, palette } from '../src/preferences';
afterEach(() => setLanguage('ru'));
describe('languages and theme overrides', () => {
  it('translates every known phrase in all fourteen additional languages, including prefixes', () => {
    expect(languages).toHaveLength(16);
    for (const [language, catalogue] of Object.entries(catalogues)) {
      setLanguage(language as Parameters<typeof setLanguage>[0]);
      for (const [source, key] of Object.entries(english)) {
        expect(catalogue?.[key], language + ': ' + key).toBeTruthy();
        expect(t(source)).toBe(catalogue?.[key]);
        if (source.endsWith(' ')) expect(t(source + 'example.md')).toBe(catalogue?.[key] + 'example.md');
      }
    }
    setLanguage('ar'); expect(document.documentElement.dir).toBe('rtl');
    setLanguage('es'); expect(t('Копировать код')).toBe('Copiar código'); expect(document.documentElement.dir).toBe('ltr');
  });
  it('keeps overrides specific to their theme', () => {
    const settings = { ...defaultSettings, customColors: { light: { ink: '#123456' } } };
    expect(palette(settings).ink).toBe('#123456');
    expect(palette({ ...settings, theme: 'dark' }).ink).not.toBe('#123456');
  });
});
