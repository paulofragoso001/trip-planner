import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
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
  const { data: trip } = await supabase
    .from("trips")
    .select("name,destination,is_public")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();
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

  let tripQuery = supabase.from("trips").select("*").eq("slug", slug);

  if (user) {
    tripQuery = tripQuery.or(`is_public.eq.true,user_id.eq.${user.id}`);
  } else {
    tripQuery = tripQuery.eq("is_public", true);
  }

  const { data: tripBySlug } = await tripQuery.maybeSingle();
  const { data: tripById } =
    tripBySlug || !user
      ? { data: null }
      : await supabase
          .from("trips")
          .select("*")
          .eq("id", slug)
          .eq("user_id", user.id)
          .maybeSingle();
  const trip = tripBySlug || tripById;

  if (!trip) {
    if (!user) {
      redirect("/login");
    }

    notFound();
  }

  const { data: items } = await supabase
    .from("itinerary_items")
    .select("id,title,location,lat,lng,position,date_time,notes,image_url,image_urls")
    .eq("trip_id", trip.id)
    .order("position", { ascending: true, nullsFirst: false });

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-6xl">
        <Link className="text-sm font-bold text-brand hover:underline" href="/dashboard">
          Back to dashboard
        </Link>
        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            Trip itinerary
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">{trip.name}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-600">{trip.destination}</p>
        </div>
        <div className="mt-8 rounded-lg border border-line bg-white">
          <TripView trip={trip} items={items || []} />
        </div>
        {user?.id === trip.user_id ? (
          <div className="mt-8">
            <TripDetail tripId={trip.id} initialItems={items || []} />
          </div>
        ) : null}
      </section>
    </main>
  );
}
