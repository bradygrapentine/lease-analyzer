import type { ChangeEvent } from 'react';
import { LocalePickerPanel } from './LocalePickerPanel';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './system/Button';
import { FileButton } from './system/FileButton';
import { Section } from './system/Section';
import { useI18n } from '../i18n/I18nContext';

// Aria/data inventory:
//   aria-label="settings" (section root)
//   aria-label="import encrypted archive" (FileButton, preserved from
//     the deleted AppFooterControls so existing aria probes continue
//     to find the import affordance)
//
// Wave 51-A — Settings tab home for cross-cutting controls that don't
// belong on the lease-reading surface. Composes:
//   - Preferences (locale picker + theme toggle, lifted from AppHeader)
//   - Privacy disclosure (lifted from AppHeader)
//   - Data management (encrypted-archive export/import + clear-all,
//     lifted from the deleted AppFooterControls)
//
// AppLibraryAndPacksPane (pack manager, marketplace, jurisdiction
// picker, severity overrides, custom rule builder, signing key,
// audit-log panel, etc.) stays mounted at the App.tsx root for now —
// relocation under Settings is a follow-up so 11 panel-level tests
// don't have to add a tab-switch step in the same PR.

interface AppSettingsPaneProps {
  onExportArchive: () => void | Promise<void>;
  onImportArchive: (e: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onClearAll: () => void;
}

export function AppSettingsPane({
  onExportArchive,
  onImportArchive,
  onClearAll,
}: AppSettingsPaneProps): JSX.Element {
  const { t } = useI18n();
  return (
    <section aria-label="settings" className="px-4 py-4 space-y-4">
      <Section label={t('settings.section.preferences')}>
        <div className="flex flex-wrap items-center gap-3">
          <LocalePickerPanel />
          <ThemeToggle />
        </div>
      </Section>

      <Section label={t('settings.section.privacy')}>
        <details className="privacy text-small text-fg-muted">
          <summary className="cursor-pointer">{t('header.privacy.summary')}</summary>
          <ul className="mt-1 ml-4 space-y-0.5 list-disc text-fg-muted">
            <li>The PDF is parsed entirely in your browser via pdf.js.</li>
            <li>All storage is in IndexedDB on this device. No account, no sync.</li>
            <li>
              A strict Content-Security-Policy (<code>default-src &apos;self&apos;</code>) blocks
              this page from loading scripts, fonts, or data from any other origin.
            </li>
            <li>LeaseGuard is not legal advice. Findings are heuristic pattern matches.</li>
          </ul>
        </details>
      </Section>

      <Section label={t('settings.section.dataManagement')}>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="subtle" size="sm" onClick={() => void onExportArchive()}>
            {t('footer.archive.export')}
          </Button>
          <FileButton
            variant="subtle"
            size="sm"
            accept=".lgarchive,application/octet-stream"
            onFiles={(files) => {
              const synthetic = {
                target: { files },
                currentTarget: { files },
              } as unknown as ChangeEvent<HTMLInputElement>;
              void onImportArchive(synthetic);
            }}
          >
            Import encrypted archive
          </FileButton>
          {/* Wave 54-A — DESIGN.md reserves Negative Red for the LABEL of
              irrecoverable actions, not the button surface. Keep the Subtle
              shell; tint the label only. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-[var(--color-negative)] hover:text-[var(--color-negative)]"
          >
            {t('footer.clearAll')}
          </Button>
        </div>
      </Section>
    </section>
  );
}
