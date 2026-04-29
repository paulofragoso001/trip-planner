import Link from "next/link";
import { SocialLogin } from "@/components/SocialLogin";
import { login } from "./actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <section className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-panel">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
          Welcome back
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Log in</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Access your Wayline dashboard and continue building authenticated trip
          planning workflows.
        </p>

        <SocialLogin />

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
              autoComplete="current-password"
              required
            />
          </label>
          {message ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {message}
            </p>
          ) : null}
          <button
            formAction={login}
            className="rounded-lg bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Log in
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          New to Wayline?{" "}
          <Link className="font-bold text-brand hover:underline" href="/signup">
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
