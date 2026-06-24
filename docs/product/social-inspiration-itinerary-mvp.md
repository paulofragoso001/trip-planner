# Almidy Social Inspiration Itinerary MVP

## Product Summary

Almidy turns saved travel inspiration into an executable trip plan. Users paste social links, upload screenshots, or add notes; Almidy extracts places with AI, resolves them to real map locations, asks the user to approve them, then promotes approved places into the existing trip timeline, map, route plan, budget, and sharing workflows.

The product position is not "notes plus a map." Almidy is a planning assistant that converts scattered inspiration into a day-by-day route users can edit, save, and share.

## MVP Promise

Save travel idea -> AI finds place -> user confirms -> place appears on timeline and map -> user generates a simple day plan.

## Core User Flow

1. User signs in.
2. User creates a trip with destination, dates, budget, and travel style.
3. User imports a copied link, screenshot, caption, or manual note.
4. Almidy stores the import as `imported_social_posts`.
5. Worker extracts raw text with OCR when needed.
6. AI extracts candidate places into `extracted_places`.
7. Google Places resolves candidates to `place_id`, address, latitude, and longitude.
8. User reviews candidates, edits fields if needed, and promotes or dismisses.
9. Promoted places become `trip_segments`.
10. Timeline and map render the approved plan.
11. User clicks Generate plan to group the trip into a day-by-day route.
12. User edits order, saves, shares, or exports the trip.

## Mobile Screens

- Auth: clean sign-in/sign-up with OAuth and email options.
- Trips: create trip, edit trip, delete trip, and open workspace.
- Import: paste URL, upload screenshot, paste caption/text.
- Review Queue: imported source cards with extracted place candidates, confidence, source, and actions.
- Trip Timeline: TripIt-style day list with places, times, notes, and cost.
- Trip Map: pins grouped by day, with daily route preview.
- Place Detail: address, category, source evidence, notes, confidence, and edit controls.
- Generate Plan: simple action state showing success/error and changed day order.
- Sharing: invite collaborators and manage roles.
- Account: data deletion request path.

## Data Model

Current MVP tables:

- `trips`: owner trip shell, now including `travel_style`.
- `trip_segments`: approved itinerary items.
- `imported_social_posts`: user-owned imported link/screenshot/text records.
- `extracted_places`: AI candidates linked to imported posts and optional trip.
- `unfiled_items`: review/inbox pattern for non-trip-specific imports.
- `budget_records`: expenses and category totals.
- `trip_collaborators`: collaborator access and roles.
- `trip_collaboration_invites`: invite records.
- `calendar_connections`, `calendar_sync_items`, `calendar_sync_jobs`: calendar execution path.

Trip travel styles:

- `balanced`
- `relaxed`
- `packed`
- `food_focused`
- `culture_focused`
- `outdoors`
- `nightlife`
- `family_friendly`

## API Routes

Existing/target MVP surface:

- `POST /api/trips`: create trip.
- `PATCH /api/trips/[id]`: edit trip.
- `DELETE /api/trips/[id]`: delete trip.
- `POST /api/social-imports`: create import.
- `GET /api/social-imports`: list review queue.
- `GET /api/social-imports/[id]`: inspect import.
- `POST /api/social-imports/[id]/process`: process one import.
- `POST /api/jobs/social-import-worker`: protected worker lane.
- `POST /api/extracted-places/[id]/promote`: create a real itinerary segment.
- `DELETE /api/extracted-places/[id]`: dismiss candidate.
- `POST /api/trips/[id]/itinerary/generate`: generate a simple day route.
- `POST /api/calendar/sync`: stage sync jobs.
- `POST /api/calendar/worker`: protected calendar worker lane.

## AI Extraction Workflow

AI can suggest, but it cannot commit final itinerary records.

1. Normalize input: URL, caption, note, screenshot text, OCR text.
2. Run OCR for screenshots with the configured OCR provider.
3. Call AI with structured JSON output for travel signals.
4. Validate the model output before insert.
5. Insert candidates into `extracted_places`.
6. Mark low-confidence signals with a review reason.
7. Resolve candidates through Google Places.
8. Present candidates to the user.
9. Promote only after explicit user confirmation.

Candidate schema:

- `name`
- `city`
- `country`
- `category`
- `summary`
- `confidence`
- `source_url`
- `source_platform`
- `evidence`
- `review_reason`
- `place_id`
- `latitude`
- `longitude`

## Route Optimization Logic

MVP route planning stays explainable:

1. Take approved segments for a trip.
2. Group by date when dates exist.
3. For undated items, distribute across trip days.
4. Within each day, sort by nearest-neighbor distance from the first known location.
5. Call Google route/distance APIs once per day when coordinates exist.
6. Store or return summary distance/time.
7. Warn when a day has too many stops, high distance, or high travel time.
8. Recalculate after user edits or clicks Generate plan.

Phase 2 route logic:

- Opening hours.
- Meal windows.
- Hotel start/end anchors.
- Public transit and rideshare options.
- "Too packed" warnings based on dwell time.
- User preference weighting.

## MVP Roadmap

### Phase 1: Current Web MVP

- Supabase-backed auth, trips, segments, budget, sharing.
- Social import tables and worker.
- AI extraction with schema validation.
- Places resolution.
- Review queue.
- Promote to timeline and map.
- Generate plan button.
- Basic mobile-first web UI.

### Phase 2: Better Planning

- Travel style weighted itinerary generation.
- Rich route warnings.
- Opening-hours validation.
- Hotel/rest-stop suggestions.
- Bulk candidate review.
- Improved source thumbnails.
- Parser accuracy dashboard by source and category.

### Phase 3: Native Mobile

- Expo or React Native app.
- Share extension for links/screenshots.
- Offline saved trip access.
- Push notifications when generation completes.
- Native map gestures and saved routes.

## Launch Checklist

Functional:

- Sign up/login works in production.
- Create/edit/delete trip works.
- Travel style persists.
- Import URL/text/screenshot works.
- Worker processes pending imports.
- Extracted places appear in review queue.
- Promote creates `trip_segments`.
- Promoted item appears on timeline and map.
- Generate plan reorders or groups itinerary.
- Sharing invite flow works.
- Non-collaborator cannot access private trip.

AI:

- Structured output validation rejects malformed responses.
- Low-confidence candidates stay review-only.
- AI never writes final itinerary records directly.
- OCR errors are visible but do not block text imports.

API:

- All write routes require auth.
- Worker routes require worker secrets.
- Production `/api/health` is healthy.
- Optional `REDIS_URL` failure does not mark app unhealthy.

Security and Privacy:

- Supabase RLS enabled on all public tables.
- Service-role key is server-side only.
- OAuth state cookie validation stays enabled.
- Uploaded screenshots are user-scoped.
- Social content is stored only for user planning/review.
- Privacy and Terms pages are production-visible.
- Account/data deletion path exists.

Performance:

- Import creation responds quickly and defers processing to worker.
- Large screenshot OCR does not block the UI.
- Timeline/map pages render empty, loading, and error states.
- Mobile layout avoids overlapping sticky content.

Testing:

- TypeScript build.
- Dashboard smoke test.
- Social import loop test.
- Calendar OAuth contract test.
- Calendar worker integration test.
- RLS/cross-user audit.
- Production smoke test against deployed URL.

## Implementation Notes

- Keep mobile web as the first surface. Do not start Expo until the core loop proves value.
- Keep `trip_segments` as the authoritative itinerary table.
- Keep `extracted_places` as suggestion/audit data, not final trip state.
- Use `travel_style` as the first preference input for itinerary generation.
- Keep provider-specific social metadata in JSONB, not top-level columns.
