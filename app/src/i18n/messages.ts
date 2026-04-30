/**
 * i18n message catalog — `en` baseline.
 *
 * Keys are flat dotted strings (`findings.empty`, `pack.import.success`).
 * The `Messages` type is derived from the `en` catalog so every locale is
 * forced — by `satisfies Partial<Messages>` — to use a known key.
 *
 * Locale resolution + fallback live in `I18nProvider.tsx`. The fallback
 * chain is: active locale → `en` → key string (with a one-time console
 * warning on a fully-missing key).
 *
 * No formatting library; `formatMessage(template, params)` does
 * `{name}` interpolation only. Pluralization + ICU are explicitly out of
 * scope for the Wave 11 scaffold.
 */

export const en = {
  // Header / nav
  'app.title': 'LeaseGuard',
  'app.tagline': 'Private, local-first lease analyzer. Nothing leaves your device.',
  'header.privacy.summary': 'Privacy & how this works',
  'header.upload.label': 'Upload lease',
  'header.trySample': 'Try a sample lease',
  'header.view.current': 'Current lease',
  'header.view.portfolio': 'Portfolio',
  'header.view.redline': 'Redline',
  'header.view.settings': 'Settings',
  'settings.section.preferences': 'Preferences',
  'settings.section.privacy': 'Privacy',
  'settings.section.libraryAndPacks': 'Library & rule packs',
  'settings.section.dataManagement': 'Data management',

  // Locale picker
  'locale.picker.label': 'Language',
  'locale.picker.en': 'English',
  'locale.picker.es': 'Español',

  // Status / errors
  'status.analyzing': 'Analyzing {fileName}…',
  'status.error': 'Could not analyze this file: {message}',

  // Findings actions
  'findings.export.json': 'Export findings (JSON)',
  'findings.export.html': 'Export findings (printable HTML)',
  'findings.export.signed': 'Export findings (signed JSON)',
  'findings.empty': 'No findings yet.',

  // Pack manager messages (used by future migrations; seeded now)
  'pack.import.success': 'Pack imported.',
  'pack.import.failure': 'Pack import failed: {message}',

  // Footer
  'footer.archive.export': 'Export encrypted archive',
  'footer.archive.import': 'Import encrypted archive',
  'footer.clearAll': 'Clear all saved data',
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

// `en` must structurally satisfy the full `Messages` record.
export const enMessages: Messages = en satisfies Messages;

/**
 * Hand-rolled `{name}` interpolation. No ICU, no pluralization.
 * Unknown placeholders are left untouched so a typo surfaces in QA
 * instead of being silently dropped.
 */
export function formatMessage(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
