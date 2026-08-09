# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A pure static link shortener hosted on GitHub Pages (`sh770.github.io/links`), written in Hebrew (RTL UI, Hebrew comments). No build step, no frameworks, no npm — plain HTML/JS/CSS only. There is nothing to build, lint, or test; `package.json` does not exist and `server.js` is a standalone `node server.js` convenience static server for local preview (port 5500, mimics GitHub Pages' extensionless-URL resolution, but does NOT replicate the 404-routing that powers redirects).

## Architecture (the non-obvious part)

The whole system runs on the **GitHub Pages 404 trick**:

- `links.json` is the database. **The alias/slug is the JSON key**, not a field inside the record (`links[slug]` → `{url, created, maxClicks, passwordHash}`).
- `404.html` is served by GitHub Pages for every non-existent path. It extracts the slug from `location.pathname`, fetches `links.json`, and performs the redirect — enforcing `maxClicks` and `passwordHash` (SHA-256 via Web Crypto) client-side. A valid unprotected link redirects silently with no UI; UI appears only for not-found / expired / password-required cases.
- `admin.html` is the management UI. There is no backend: it authenticates by holding a **GitHub fine-grained PAT entered by the user** (stored only in the browser's localStorage, never in the repo) and writes changes via the GitHub REST API (`PUT /contents/links.json` with base64 content + current SHA). After saving, GitHub Pages' deploy delay means changes take a minute or two to appear publicly.
- `index.html` is a public, token-free catalog of all links with search.
- `server.js` — local dev server only; not used in production.

## Cross-file invariants (breaking these silently breaks the site)

- **`COUNTER_PREFIX` must be identical in `404.html:22` and `admin.html:63`.** Click counts live in the external countapi.mileshilliard.com service keyed by `COUNTER_PREFIX + slug`; if the prefixes drift, counts appear as 0.
- **`OWNER`/`REPO` constants in `admin.html` (~line 68)** — needed for GitHub API calls; must be hand-edited if the repo moves accounts/names. (The public base path, by contrast, is auto-detected from `location.pathname` in every page, so custom domains need no code change.)
- **Reserved slugs:** `admin`, `index`, `404` are always blocked (`RESERVED_SLUGS` in admin.html) because GitHub Pages resolves extensionless URLs to the real HTML files, bypassing the 404 redirect mechanism.
- **Slug validation:** new slugs must match `/^[A-Za-z0-9_-]+$/` (`SLUG_RE`).
- Any "save" flow in admin must re-fetch the current JSON **SHA** immediately before `PUT /contents/links.json`, or save fails on concurrent edits.

## Security conventions (established by past fixes — preserve them)

- **Never interpolate dynamic values into HTML/JS unescaped.** Use `escapeHtml` before injecting into HTML, `attrJs`/`attrHtml` before injecting into `onclick="..."` attributes, in both `404.html` and `admin.html`. XSS via malicious slugs was a real past vulnerability (admin token sits in the site's localStorage).
- **Don't look up DOM elements via CSS selectors built from slugs** (`#row-<slug>` breaks on special chars in legacy slugs); use ID-based lookup + traversal.
- Never hardcode tokens in code or commit `token.txt` (it contains a real PAT — do not read it into commits/docs).
- Known, documented-unfixable limitations (don't report as new bugs): `links.json` is public so password hashes are crackable offline ("soft" protection), and the public counter API allows DoS on `maxClicks`.

## Editing notes

- Keep UI text and code comments in Hebrew, matching existing style; keep the dark rounded theme in `style.css` consistent across pages.
- Internal links are extensionless (`href="admin"` not `href="admin.html"`) — a GitHub Pages behavior the site relies on.
