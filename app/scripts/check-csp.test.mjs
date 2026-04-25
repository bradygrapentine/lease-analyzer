// Wave 11 Part D — CSP regression test fixture.
//
// Drives `scanSource` directly with happy + planted-CDN-URL fixtures so we
// don't have to spawn the script as a subprocess. The script-level main()
// path (file IO, exit codes) is exercised by the CI step itself.

import { describe, it, expect } from 'vitest';
import { scanSource, isAllowed, checkCspFiles } from './check-csp.mjs';

describe('check-csp · isAllowed', () => {
  it('allows same-origin and inert schemes', () => {
    for (const url of [
      '/assets/index-abc.js',
      'assets/index-abc.js',
      './foo.css',
      '../bar.png',
      'data:image/png;base64,iVBORw0KG',
      'blob:http://localhost/abc',
      'mailto:nobody@example.com',
      '#anchor',
      '',
    ]) {
      expect(isAllowed(url)).toBe(true);
    }
  });

  it('rejects any explicit external scheme', () => {
    for (const url of [
      'https://cdn.example.com/foo.js',
      'http://example.com/foo.css',
      '//cdn.example.com/foo.js',
      'wss://socket.example.com/',
      'ftp://files.example.com/x',
    ]) {
      expect(isAllowed(url)).toBe(false);
    }
  });
});

describe('check-csp · scanSource (happy path)', () => {
  it('returns no hits for a clean index.html', () => {
    const indexHtml = `
      <!doctype html>
      <html>
        <head>
          <meta http-equiv="Content-Security-Policy" content="default-src 'self'">
          <link rel="icon" type="image/svg+xml" href="/icon.svg" />
          <link rel="stylesheet" href="/assets/index-abc.css" />
          <script type="module" src="/assets/index-abc.js"></script>
        </head>
        <body>
          <img src="/og.png" />
          <style>.x { background-image: url('/bg.png'); }</style>
        </body>
      </html>
    `;
    expect(scanSource(indexHtml, 'dist/index.html')).toEqual([]);
  });

  it('returns no hits for a clean sw.js', () => {
    const swJs = `
      importScripts('/workbox-abc.js');
      const PRECACHE = ['/index.html', '/assets/index-abc.js', '/icon.svg'];
    `;
    expect(scanSource(swJs, 'dist/sw.js')).toEqual([]);
  });

  it('checkCspFiles aggregates an empty result when both inputs are clean', async () => {
    const indexHtml = '<script src="/assets/x.js"></script>';
    const swJs = "importScripts('/wb.js');";
    const hits = await checkCspFiles({ indexHtml, swJs });
    expect(hits).toEqual([]);
  });
});

describe('check-csp · scanSource (regression — planted CDN URL)', () => {
  it('flags a third-party <script src> in index.html', () => {
    const indexHtml = `
      <!doctype html>
      <html><head>
        <script type="module" src="https://cdn.jsdelivr.net/npm/pdfjs-dist/build/pdf.min.js"></script>
      </head></html>
    `;
    const hits = scanSource(indexHtml, 'dist/index.html');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      source: 'dist/index.html',
      label: 'script src',
      url: 'https://cdn.jsdelivr.net/npm/pdfjs-dist/build/pdf.min.js',
    });
  });

  it('flags a third-party <link href> (e.g. Google Fonts) in index.html', () => {
    const indexHtml = `
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />
    `;
    const hits = scanSource(indexHtml, 'dist/index.html');
    expect(hits).toHaveLength(1);
    expect(hits[0].label).toBe('link href');
  });

  it('flags CSS url() with an external host', () => {
    const indexHtml = `
      <style>@font-face { src: url(https://cdn.example.com/font.woff2); }</style>
    `;
    const hits = scanSource(indexHtml, 'dist/index.html');
    expect(hits.some((h) => h.label === 'css url()' && h.url.startsWith('https://'))).toBe(true);
  });

  it('flags importScripts() with an external host in sw.js', () => {
    const swJs = `importScripts('https://storage.googleapis.com/workbox/workbox-sw.js');`;
    const hits = scanSource(swJs, 'dist/sw.js');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      source: 'dist/sw.js',
      label: 'importScripts',
      url: 'https://storage.googleapis.com/workbox/workbox-sw.js',
    });
  });

  it('flags multiple regressions across sources via checkCspFiles', async () => {
    const indexHtml = `<img src="https://cdn.example.com/logo.png" />`;
    const swJs = `importScripts('https://cdn.example.com/sw-extra.js');`;
    const hits = await checkCspFiles({ indexHtml, swJs });
    expect(hits).toHaveLength(2);
    const sources = hits.map((h) => h.source).sort();
    expect(sources).toEqual(['dist/index.html', 'dist/sw.js']);
  });

  it('protocol-relative URLs (//cdn.example.com/x) are flagged as third-party', () => {
    const indexHtml = `<script src="//cdn.example.com/x.js"></script>`;
    const hits = scanSource(indexHtml, 'dist/index.html');
    expect(hits).toHaveLength(1);
    expect(hits[0].url).toBe('//cdn.example.com/x.js');
  });
});
