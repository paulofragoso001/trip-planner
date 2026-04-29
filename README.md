# Wayline Next.js Auth App

This is a Next.js App Router scaffold for Wayline with:

- Supabase Auth
- Cookie-based SSR helpers via `@supabase/ssr`
- Tailwind CSS
- Login page at `/login`
- Signup page at `/signup`
- Email confirmation callback at `/auth/callback`
- Protected dashboard at `/dashboard`
- Supabase `trips` table migration with row-level security
- Auth-protected CRUD API routes for trips
- Responsive dashboard UI for creating, editing, refreshing, and deleting trips

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with values from your Supabase project:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-browser-key
```

The Google Maps key should be a browser key with the Maps JavaScript API enabled.

Run the trip database migration in Supabase SQL editor or through the Supabase CLI:

```bash
supabase/migrations/001_create_trips.sql
```

## Trip API

- `GET /api/trips` lists the signed-in user's trips.
- `POST /api/trips` creates a trip.
- `GET /api/trips/:id` reads one trip.
- `PATCH /api/trips/:id` updates one trip.
- `DELETE /api/trips/:id` deletes one trip.

The `trips` table is protected with RLS policies, so each user only sees and changes records where `user_id` matches their Supabase auth user.

## Itinerary Maps

Trip itinerary JSON items can include coordinates using any of these shapes:

```json
{
  "title": "Hotel check-in",
  "date": "2026-05-10",
  "time": "15:00",
  "latitude": 35.6812,
  "longitude": 139.7671
}
```

```json
{
  "name": "Dinner reservation",
  "location": {
    "lat": 35.6655,
    "lng": 139.7707
  }
}
```

Items with valid coordinates are plotted as numbered Google Maps markers and connected with a route line.

Supabase’s current Next.js guidance recommends `@supabase/ssr`, a browser client, a server client, and a proxy to refresh cookie sessions.
