import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { isDemoTripId, isUuid } from "@/lib/server/trip-id";
import type { TripCollaboratorView, TripSharingData } from "./types";

type CollaboratorRow = {
  email: string | null;
  id: string;
  role: string | null;
  status: string | null;
};

const demoCollaborators: TripCollaboratorView[] = [
  { email: null, id: "demo-paulo", name: "Paulo", role: "Owner", status: "Active" },
  { email: null, id: "demo-ana", name: "Ana", role: "Editor", status: "Active" },
  { email: null, id: "demo-marcus", name: "Marcus", role: "Viewer", status: "Active" }
];

export async function loadTripSharingData(tripId: string): Promise<TripSharingData> {
  if (isDemoTripId(tripId)) {
    return { collaborators: demoCollaborators, error: null, tripId };
  }

  if (!isUuid(tripId)) {
    return emptySharingData(tripId, "Invalid trip id.");
  }

  const auth = await authorizeDashboardApi();

  if (!auth) {
    return emptySharingData(tripId, "Sign in to load trip sharing data.");
  }

  const { data, error } = await auth.supabase
    .from("trip_collaborators")
    .select("id,email,role,status")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  if (error) {
    return emptySharingData(tripId, "Could not load trip collaborators.");
  }

  const collaborators = ((data || []) as CollaboratorRow[]).map(mapCollaborator);

  return {
    collaborators,
    error: null,
    tripId
  };
}

function emptySharingData(tripId: string, error: string): TripSharingData {
  return {
    collaborators: [],
    error,
    tripId
  };
}

function mapCollaborator(row: CollaboratorRow): TripCollaboratorView {
  return {
    email: row.email,
    id: row.id,
    name: displayName(row.email),
    role: titleCase(row.role || "viewer"),
    status: titleCase(row.status || "active")
  };
}

function displayName(email: string | null) {
  if (!email) {
    return "Collaborator";
  }

  const local = email.split("@")[0] || email;
  return titleCase(local.replace(/[._-]+/g, " "));
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
