# Deployment notes

LeaseGuard ships as a static SPA built by Vite (`cd app && npm run build` →
`app/dist/`). Production hosting is currently undecided / out-of-tree; this
note exists to record the security headers that must accompany any host
config when one is added.

## Required HTTP response headers (production)

The host **MUST** emit the following on every HTML response:

```
Content-Security-Policy: frame-ancestors 'none'
```

### Why a header (and not the existing `<meta>`)

Per [W3C CSP Level 3 §1.1.4 / §4](https://www.w3.org/TR/CSP3/#meta-element)
the `frame-ancestors` directive is **explicitly ignored** when delivered
via `<meta http-equiv="Content-Security-Policy">`. Browsers honor it only
on the HTTP response. Wave 59 Slice 3 dropped that no-op meta directive
and moved enforcement into the Vite dev server (`app/vite.config.ts`
`server.headers` and `preview.headers`).

### Other CSP directives

The remaining directives (`default-src`, `script-src`, `style-src`,
`img-src`, `font-src`, `connect-src`, `worker-src`, `object-src`,
`base-uri`, `form-action`) **are** effective via `<meta>` and remain in
`app/index.html`. Production hosts may optionally upgrade them to a
header for defense-in-depth, but they're not strictly required to.

## Host-specific snippets

When a host is selected, drop the snippet here.

### Netlify (`netlify.toml`)

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "frame-ancestors 'none'"
```

### Vercel (`vercel.json`)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "frame-ancestors 'none'" }
      ]
    }
  ]
}
```

### Cloudflare Pages / generic `_headers`

```
/*
  Content-Security-Policy: frame-ancestors 'none'
```

### nginx

```
add_header Content-Security-Policy "frame-ancestors 'none'" always;
```

## Verification

After deploy, confirm:

```bash
curl -sI https://<host>/ | grep -i content-security-policy
```

The response must include `frame-ancestors 'none'`. If absent, the page is
embeddable in arbitrary iframes — clickjacking defense is missing.
