# Yoga & Mindfulness Studio (booking app)

Small React app for a pretend yoga studio - browse published courses, book class sessions when you're logged in, and if you're marked as an organiser in the database you get an admin area to manage courses, sessions, and user profiles.

Backend is **Supabase** (Postgres + Auth + Row Level Security). There's no custom server in this repo; the frontend talks straight to Supabase with the anon key.

Hosted at https://wad-2-9ihz.vercel.app

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

All the real security is in **Supabase**: tables like `courses`, `class_sessions`, `bookings`, `profiles`, plus RLS policies. If something 403s or returns empty, check the policies before blaming the React code.

Organiser access is driven off `profiles.is_organiser`. Full account deletion isn't in the app — you'd do that in Supabase Auth if you need it.

## Supabase setup (from scratch)

If you want to run this project yourself, you need to create a Supabase project and run the schema.

1. Create a new project in the Supabase dashboard.
2. Go to **SQL Editor** → New query.
3. Copy/paste and run:
   - `supabase/schema.sql`

This creates:
- `profiles` (user display name + organiser flag)
- `courses` + `class_sessions` (catalogue)
- `bookings` (reservations)
- RLS policies for public browsing vs logged-in bookings vs organiser admin
- A trigger that auto-creates a `profiles` row when a user signs up (using `full_name` from signup metadata)

### Make your first organiser

After you sign up with your own email/password in the app, go to Supabase:
- Table Editor → `profiles`
- Find your `user_id`
- Set `is_organiser = true`

Now the **Admin** link will appear when you sign back in.

### Auth settings

In Supabase: Authentication → Providers:
- Email/password enabled (default)

If you use email confirmations, you'll need to confirm before bookings/admin work.

### Local env vars

Create `.env.local` with:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
```

Get them from Supabase Settings → API (use the **publishable** key, not the secret/service key).

## Deploying (Vercel)

1. Import the repo into Vercel.
2. Set env vars in Vercel (Project → Settings → Environment Variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy.

For sign-in redirects, set your deployed URL in Supabase:
- Authentication → URL configuration → Site URL (and add it to Redirect URLs if needed)

## Project layout (roughly)

- `src/pages/` — main screens (home, courses, detail, login, bookings)
- `src/pages/admin/` — dashboard, course editor, users
- `src/auth/AuthContext.tsx` — session + profile
- `src/components/` — layout, route guards (`RequireUser`, `RequireOrganiser`)
- `src/lib/supabase.ts` — client factory + env check

---

If something's broken and it's not obvious, check the browser console and the Network tab first — half the time it's RLS or a typo in the env file.
