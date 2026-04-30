// Wave 51-B — Offline / on-device indicator.
//
// Pure presentation. The app is local-first by construction (CSP
// `default-src 'self'`, no network egress after load), so this badge
// is informational, not a live connectivity probe. Its job is to
// telegraph "nothing leaves your device" the moment the page loads.

export function OfflineDot(): JSX.Element {
  return (
    <span
      role="status"
      aria-label="offline, on-device"
      className="inline-flex items-center gap-1.5 font-sans text-small text-fg-muted uppercase tracking-wide"
    >
      <span
        aria-hidden="true"
        className="inline-block w-1.5 h-1.5 rounded-full bg-positive shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-positive)_18%,transparent)]"
      />
      Offline · On-device
    </span>
  );
}
