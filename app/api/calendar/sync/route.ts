import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import {
  syncTripToCalendar,
  type CalendarSyncClient
} from "@/lib/server/calendar-sync";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCalendarSyncInput } from "@/lib/validators/calendar-sync";

const routeName = "calendar/sync";

export async function POST(request: Request) {
  try {
    const auth = await authorizeDashboardApi<CalendarSyncClient>();

    if (!auth) {
      return unauthorized();
    }

    const validation = validateCalendarSyncInput(await readJson(request));

    if (!validation.ok) {
      return validationFailure("Invalid calendar sync payload.", validation.details);
    }

    const syncClient = createAdminClient() ?? auth.supabase;
    const result = await syncTripToCalendar(
      syncClient as unknown as CalendarSyncClient,
      auth.userId,
      validation.value
    );

    return apiCanonicalSuccess({ calendarSync: result });
  } catch (error) {
    return handleApiError(error, routeName);
  }
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
