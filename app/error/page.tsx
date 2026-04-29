export default function ErrorPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <section className="w-full max-w-md rounded-lg border border-line bg-white p-6 text-center shadow-panel">
        <h1 className="text-3xl font-black tracking-tight">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The authentication request could not be completed. Try again from the
          login or signup page.
        </p>
      </section>
    </main>
  );
}
