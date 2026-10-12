# SATS Frontend Development Workflow (Phase 1.3)

This document describes the Vite + Tailwind CSS + TypeScript development workflow used with XAMPP/PHP. Functional MVP scope is unchanged; this only configures how frontend assets are built and loaded.

## Daily workflow

1. Start **Apache** in the XAMPP Control Panel.
2. In Cursor’s terminal, from the project root (`C:\xampp\htdocs\sats`), run:

   ```bash
   npm run dev
   ```

3. Open the app in the browser (**not** port 5173):

   [http://localhost/sats/public/](http://localhost/sats/public/)

   `http://localhost:5173/` is only the Vite asset/HMR server. Opening it alone will not show the SATS UI (it may show a short tip page after restarting `npm run dev`).

4. Edit:
   - PHP views under `app/Views/`
   - CSS under `resources/css/`
   - TypeScript under `resources/ts/`

5. Expect:
   - **CSS / TypeScript:** hot updates via Vite (typically `http://localhost:5173/`)
   - **PHP views:** automatic full browser reload when practical (`vite-plugin-full-reload`); otherwise refresh manually

Always open the **PHP URL** served by Apache. Do not develop primary UI against the Vite origin alone.

## How asset loading works

| Mode | When | What the layout loads |
|------|------|------------------------|
| **Development** | `npm run dev` is running (creates `public/hot`) | Vite client + entry from `http://localhost:5173/` |
| **Production-style** | No `public/hot`; built files present | Hashed JS/CSS from `public/assets/` via Vite manifest |

Helper: `App\Support\Vite` (used by `app/Views/layouts/main.php`).

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | **Primary** local frontend command — HMR, watches views |
| `npm run build` | Compile production assets into `public/assets/` |
| `npm run preview` | Optional local preview of the production build on localhost |

## Security notes (local)

- Vite is bound to **`localhost:5173`** only (not `0.0.0.0`).
- A Vite middleware blocks serving `app/`, `storage/`, `routes/`, `docs/`, `*.php`, and `.env` from the Vite server.
- Apache root `.htaccess` continues to deny direct HTTP access to private project paths.
- `public/hot` is gitignored and removed when the dev server stops / when building.
- If `public/hot` is left behind after an abrupt stop, PHP probes `localhost:5173` and falls back to built assets when Vite is down. You can also delete `public/hot` or run `npm run build`.

## First-time setup

```bash
cd C:\xampp\htdocs\sats
npm install
npm run build
```

`npm run build` is optional for day-to-day UI work if `npm run dev` is always running; run a build before testing without the Vite server.

## Layout notes (Phase 1.4 / 1.4A)

- Shared shell: `app/Views/layouts/main.php`, `partials/sidebar.php`, `partials/header.php`.
- Mobile sidebar logic: `resources/ts/app.ts` (`data-sidebar-toggle`, backdrop, Escape, `aria-expanded`).
- Default landing identity: **My Submissions** (`/`). Only that route is implemented; other nav items are disabled (“Soon”).
- Nav definitions: `app/Config/navigation.php`. Preview modes: `App\Support\NavPreview` + header **Nav preview** control (`?nav_preview=`). Not authentication.

## Out of scope for Phase 1.3–1.4

- Live dashboards / submission workflows / mock business APIs
- Composer, MySQL, authentication
- Laravel Vite plugin or SPA frameworks (React/Next.js)
