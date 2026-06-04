export default function AppLoading() {
  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)] text-zinc-950">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-200" />
          <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-200" />
          <div className="ml-2 flex-1 space-y-2">
            <div className="h-4 w-32 animate-pulse rounded-full bg-zinc-200" />
            <div className="h-3 w-44 animate-pulse rounded-full bg-zinc-200" />
          </div>
          <div className="h-10 w-20 animate-pulse rounded-full bg-zinc-200" />
        </div>

        <section className="mt-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="h-5 w-24 animate-pulse rounded-full bg-zinc-200" />
          <div className="mt-5 h-7 w-52 animate-pulse rounded-full bg-zinc-200" />
          <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-zinc-200" />
          <div className="mt-2 h-4 w-2/3 animate-pulse rounded-full bg-zinc-200" />
          <div className="mt-5 h-12 animate-pulse rounded-2xl bg-zinc-200" />
        </section>

        <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-36 animate-pulse rounded-3xl border border-zinc-200 bg-white shadow-sm" />
          ))}
        </section>
      </div>
    </main>
  );
}
