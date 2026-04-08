# Yoga & Mindfulness Studio (booking app)

Small React app for a pretend yoga studio — browse published courses, book class sessions when you're logged in, and if you're marked as an organiser in the database you get an admin area to manage courses, sessions, and user profiles.

Backend is **Supabase** (Postgres + Auth + Row Level Security). There's no custom server in this repo; the frontend talks straight to Supabase with the anon key.

## Stack

- React 18 + TypeScript
- Vite
- React Router
- `@supabase/supabase-js`

## Running it locally

You need Node (I used whatever ships with current LTS, 18+ is fine).

```bash
npm install
```

Create a `.env.local` in the project root (same folder as `package.json`). Vite only picks up vars that start with `VITE_`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Get those from the Supabase project dashboard → Settings → API. Don't commit `.env.local` — it's in `.gitignore` for a reason.

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

If the env vars are missing, the app shows a boring setup page instead of crashing. Handy when you clone the repo on a fresh machine and forget the keys.

## Build

```bash
npm run build
npm run preview   # optional, serves the production build locally
```

Output goes to `dist/`.

## Database / auth

All the real security is in **Supabase**: tables like `courses`, `class_sessions`, `bookings`, `profiles`, plus RLS policies. This repo assumes you've already created that project and policies to match what the UI expects (published courses visible to anon, users can only mess with their own bookings, organisers can edit courses, etc.). If something 403s or returns empty, check the policies before blaming the React code.

Organiser access is driven off `profiles.is_organiser`. Full account deletion isn't in the app — you'd do that in Supabase Auth if you need it.

## Project layout (roughly)

- `src/pages/` — main screens (home, courses, detail, login, bookings)
- `src/pages/admin/` — dashboard, course editor, users
- `src/auth/AuthContext.tsx` — session + profile
- `src/components/` — layout, route guards (`RequireUser`, `RequireOrganiser`)
- `src/lib/supabase.ts` — client factory + env check

---

If something's broken and it's not obvious, check the browser console and the Network tab first — half the time it's RLS or a typo in the env file.
