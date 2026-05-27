import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import {
  refreshItineraryFlightStatus,
  type FlightStatusClient
} from "@/lib/server/flight-status";
import { createClient } from "@/lib/supabase/server";
import { validateRefreshFlightStatus } from "@/lib/validators/flight-status";

const routeName = "itinerary/flight-status";

export async function POST(request: Request) {
  try {
    const validation = validateRefreshFlightStatus(await readJson(request));

    if (!validation.ok) {
      return validationFailure("Invalid flight status payload.", validation.details);
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized();
    }

    const result = await refreshItineraryFlightStatus(
      supabase as unknown as FlightStatusClient,
      user.id,
      validation.value
    );

    return apiCanonicalSuccess({
      alert: result.alert,
      item: result.item,
      ok: true,
      provider: result.provider
    });
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
