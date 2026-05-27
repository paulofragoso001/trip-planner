import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import {
  createItineraryItem,
  listItineraryItems,
  type ItineraryClient
} from "@/lib/server/itinerary";
import { createClient } from "@/lib/supabase/server";
import {
  validateCreateItineraryItem,
  validateItineraryQuery
} from "@/lib/validators/itinerary";

const routeName = "itinerary";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const validation = validateItineraryQuery(searchParams);

    if (!validation.ok) {
      return validationFailure("Invalid itinerary query.", validation.details);
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized();
    }

    const items = await listItineraryItems(
      supabase as unknown as ItineraryClient,
      user.id,
      validation.value.tripId
    );

    return apiCanonicalSuccess({ itinerary: items });
  } catch (error) {
    return handleApiError(error, routeName);
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const validation = validateCreateItineraryItem(await readJson(request), searchParams);

    if (!validation.ok) {
      return validationFailure("Invalid itinerary payload.", validation.details);
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized();
    }

    const item = await createItineraryItem(
      supabase as unknown as ItineraryClient,
      user.id,
      validation.value
    );

    return apiCanonicalSuccess({ item }, { status: 201 });
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
