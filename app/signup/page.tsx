import Link from "next/link";
import Auth from "@/components/Auth";
import { SocialLogin } from "@/components/SocialLogin";
import { signup } from "./actions";

export default async function SignupPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-none bg-white shadow-panel sm:min-h-0 sm:rounded-2xl lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="bg-ink px-6 py-8 text-white sm:px-8 lg:flex lg:flex-col lg:justify-between lg:p-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-200">
              Start planning
            </p>
            <h1 className="mt-3 max-w-sm text-3xl font-black tracking-tight sm:text-4xl">
              Create your Almidy account
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-200">
              Save trips, map routes, import itinerary items, and keep travelers
              updated from one responsive workspace.
            </p>
          </div>

          <div className="mt-8 grid gap-3 text-sm text-slate-200 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              Smart trip itinerary
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              Maps and routes
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              Live comments
            </div>
          </div>
        </aside>

        <div className="flex items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
          <div className="w-full max-w-md">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Create account
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              Join Almidy
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Use a magic link for the fastest setup, or create an account with
              email and password.
            </p>

            <SocialLogin />

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Or use email
              </span>
              <div className="h-px flex-1 bg-line" />
            </div>

            <Auth />

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Or use password
              </span>
              <div className="h-px flex-1 bg-line" />
            </div>

            <form className="grid gap-4">
              <label htmlFor="email">
                Email
                <input id="email" name="email" type="email" autoComplete="email" required />
              </label>
              <label htmlFor="password">
                Password
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </label>
              {message ? (
                <p className="break-words rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
                  {message}
                </p>
              ) : null}
              <button
                formAction={signup}
                className="min-h-11 rounded-lg bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                Sign up
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-600">
              Already have an account?{" "}
              <Link className="font-bold text-brand hover:underline" href="/login">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
