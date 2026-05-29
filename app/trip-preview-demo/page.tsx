import { redirect } from "next/navigation";

export default function TripPreviewDemoRedirect() {
  redirect("/dashboard/trips");
}
