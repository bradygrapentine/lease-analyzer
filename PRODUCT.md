# Product

## Register

product

## Users

**Primary: renters pre-signing.** Often anxious, working at home on a laptop in
the evening, deciding whether to sign a lease they only half-understand. Not
lawyers. They want to know which clauses actually matter and why, in plain
language, without sending the PDF to a third party.

**Secondary: practitioners** (small-firm tenant attorneys, paralegals, housing
counselors) who triage many leases a week, compare against a known-good
"standard" lease, redline, and export signed findings. They reward density,
keyboard flow, and audit trails.

The renter is the design north star: if the renter understands the screen, the
practitioner can always go faster. The reverse is not true.

## Product Purpose

LeaseGuard is a local-first PWA that reads a lease PDF in the browser and
returns a prioritized, explainable list of clauses that matter. Nothing leaves
the device: strict `default-src 'self'` CSP, service worker precache, nine
IndexedDB stores, append-only hash-chained audit log, Ed25519-signed export.

Success is a renter who, in one sitting, identifies the three clauses worth
pushing back on and feels they understand why. Secondary success is a
practitioner who can run the same analysis at ten times the speed and trust
the audit trail in court.

## Brand Personality

Clear, calm, informative. The voice of a careful reader explaining a document,
not a product trying to impress. Plainspoken where the law is plainspoken;
precise where it is not. Never cheerful, never alarming, never coy.

Think of a long-form explainer (NYT Cooking's instructional voice, Stripe
Docs' worked-example tone) rather than a SaaS landing page or a legal-tech
sales deck.

## Anti-references

- **LegalZoom and the friendly-legal genre.** No mascots, no "we make legal
  easy!" cheer, no rounded purple gradients. The document is serious; the
  interface should respect that.
- **Crypto / neon-on-black.** No glowing accents, no animated gradients, no
  "fintech-coded" aggression. This is the opposite emotional register.
- **Generic SaaS dashboard.** No hero-metric tiles, no rainbow chart palettes,
  no identical card grids of features, no big-blue-CTA-on-white.
- **DocuSign-corporate.** No stock photos of handshakes, no navy-and-yellow
  trust theatre.

## Design Principles

1. **Document first, chrome second.** The lease, the finding, the redline are
   the subjects. UI scaffolding is rule lines and quiet labels, not panels
   competing for attention.
2. **Severity is earned, not decorative.** Color carries meaning (high /
   medium / low / info). Never used to liven up a section. Never the sole
   signal: pair with icon, label, or position.
3. **Trust is shown, not claimed.** The local-first guarantee is visible in
   the UI (offline indicator, audit-log surfacing, signed-export affordance),
   not asserted in marketing copy on a settings screen.
4. **Plain language outranks legal language.** Where the rule pack uses a
   term of art, surface a one-line plain reading next to it. The renter
   should never need a glossary to understand a finding.
5. **Density without noise.** Practitioner views can be dense; renter views
   stay calm. Both share the same tokens, type scale, and severity
   vocabulary; they differ in information per square inch, not in style.

## Accessibility & Inclusion

- **WCAG 2.2 AA** as the baseline across all flows; AAA contrast on body text
  and finding bodies where achievable without flattening hierarchy.
- **Severity is never color-only.** Every severity-tinted surface carries an
  icon and a text label so red-green color-blind users and screen-reader users
  get the same signal.
- **Reduced motion.** Honor `prefers-reduced-motion`. No incidental motion;
  motion is reserved for state transitions where it aids comprehension
  (panel mount, redline diff reveal).
- **Keyboard-first.** Every panel reachable, every finding actionable, every
  comparison row navigable without a pointer. Focus rings are visible and
  on-brand (ink, not browser default).
- **Reading-impairment friendly.** Body type at a comfortable serif size with
  a 65–75ch measure, not the 90ch+ block walls common in legal tools.
