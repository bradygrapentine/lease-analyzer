# Tauri desktop wrapper (scaffold)

This directory holds a **scaffold** for wrapping LeaseGuard as a native
desktop app via [Tauri 2](https://v2.tauri.app/). It is not wired into CI
and has not been built here, because building requires the Rust toolchain
(`rustup`, cargo) which isn't part of the project's default dev
environment.

## To build locally

Prereqs: Rust (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
and the Tauri CLI (`cargo install tauri-cli --version "^2"`).

```bash
cd app
npm install
cargo tauri dev    # runs vite dev server + spawns the native window
cargo tauri build  # produces a signed (or unsigned) .dmg / .app / .msi
```

## Why Tauri over Electron

- Bundle size: a Tauri app is typically < 10 MB; Electron ships Chromium.
- CSP parity: the same `default-src 'self'` posture as the PWA, configured
  in `tauri.conf.json`.
- Filesystem access: makes a future "local library folder" feature
  straightforward (user picks a directory; app persists PDFs there).

## Known next steps

- [ ] Generate the platform icons into `src-tauri/icons/` (Tauri CLI
      has a command: `cargo tauri icon ../public/icon.svg`).
- [ ] Add a `tauri-apps/plugin-dialog` integration for a native "Open
      lease folder" experience.
- [ ] Wire `npm run tauri:dev` and `npm run tauri:build` scripts in
      `package.json`.
- [ ] CI job on macOS + Windows runners that at least `cargo check`s
      this directory.
- [ ] Migrate IndexedDB usage to Tauri's file-backed store if the user
      opts into the "my library folder" mode.
