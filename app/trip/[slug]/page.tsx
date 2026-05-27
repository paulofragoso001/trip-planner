import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TripDetail } from "@/components/trip-detail";
import TripView from "@/components/TripView";
import { ensureProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

type TripPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: TripPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: tripBySlug } = await supabase
    .from("trips")
    .select("name,destination,is_public")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  const { data: tripById } =
    tripBySlug
      ? { data: null }
      : await supabase
          .from("trips")
          .select("name,destination,is_public")
          .eq("id", slug)
          .eq("is_public", true)
          .maybeSingle();
  const trip = tripBySlug || tripById;
  const title = trip?.name || "Trip itinerary";
  const description = trip?.destination
    ? `Trip itinerary for ${trip.destination}`
    : "Trip itinerary";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website"
    },
    twitter: {
      card: "summary",
      title,
      description
    }
  };
}

export default async function TripPage({ params }: TripPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    await ensureProfile(supabase, user);
  }

  let tripBySlugQuery = supabase.from("trips").select("*").eq("slug", slug);

  if (user) {
    tripBySlugQuery = tripBySlugQuery.or(`is_public.eq.true,user_id.eq.${user.id}`);
  } else {
    tripBySlugQuery = tripBySlugQuery.eq("is_public", true);
  }

  const { data: tripBySlug } = await tripBySlugQuery.maybeSingle();
  let tripByIdQuery = supabase.from("trips").select("*").eq("id", slug);

  if (user) {
    tripByIdQuery = tripByIdQuery.or(`is_public.eq.true,user_id.eq.${user.id}`);
  } else {
    tripByIdQuery = tripByIdQuery.eq("is_public", true);
  }

  const { data: tripById } =
    tripBySlug
      ? { data: null }
      : await tripByIdQuery.maybeSingle();
  const trip = tripBySlug || tripById;

  if (!trip) {
    return <PrivateTripState signedIn={Boolean(user)} />;
  }

  const { data: items } = await supabase
    .from("itinerary_items")
    .select("id,title,location,lat,lng,position,date_time,notes,image_url,image_urls,segment_type,provider,confirmation_code,booking_url")
    .eq("trip_id", trip.id)
    .order("position", { ascending: true, nullsFirst: false });

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="mx-auto w-full max-w-7xl">
        <Link className="text-sm font-bold text-brand hover:underline" href="/dashboard">
          Back to dashboard
        </Link>
        <div className="mt-8 rounded-lg border border-line bg-white">
          <TripView trip={trip} items={items || []} />
        </div>
        {user?.id === trip.user_id ? (
          <div className="mt-8">
            <TripDetail
              tripId={trip.id}
              tripName={trip.name || trip.title}
              tripDestination={trip.destination}
              initialItems={items || []}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}

function PrivateTripState({ signedIn }: { signedIn: boolean }) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-lg rounded-lg border border-line bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
          Private trip
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          This trip is not shared yet
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Ask the trip owner to copy a share link from Wayline
          {signedIn
            ? ", or switch to the owner account to view private itinerary details."
            : ", or sign in with the owner account to view private itinerary details."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {signedIn ? null : (
            <Link
              className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand/90"
              href="/login"
            >
              Sign in
            </Link>
          )}
          <Link
            className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink transition hover:bg-slate-50"
            href="/dashboard"
          >
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
