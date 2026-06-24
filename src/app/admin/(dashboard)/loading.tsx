export default function AdminLoading() {
  return (
    <div className="space-y-7 animate-in fade-in duration-200 text-slate-300" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading admin dashboard…</span>

      <div className="flex flex-col gap-4 border-b border-slate-850/60 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="h-3 w-28 animate-pulse rounded-full bg-slate-800" />
          <div className="h-7 w-72 animate-pulse rounded-lg bg-slate-800/80" />
          <div className="h-3 w-96 max-w-full animate-pulse rounded-full bg-slate-800/60" />
        </div>
        <div className="h-12 w-44 animate-pulse rounded-xl border border-slate-850/80 bg-[#181818]/60" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-850/80 bg-[#181818]/90 p-5 shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-2.5 w-20 animate-pulse rounded-full bg-slate-800" />
                <div className="h-6 w-24 animate-pulse rounded-lg bg-slate-800/80" />
              </div>
              <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-800/60" />
            </div>
            <div className="mt-4 h-2.5 w-28 animate-pulse rounded-full bg-slate-800/40" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-850/80 bg-[#181818] p-6 shadow-md">
            <div className="mb-5 flex items-center justify-between border-b border-slate-850/50 pb-3">
              <div className="space-y-2">
                <div className="h-3.5 w-40 animate-pulse rounded-full bg-slate-800" />
                <div className="h-2.5 w-56 animate-pulse rounded-full bg-slate-800/60" />
              </div>
              <div className="h-7 w-28 animate-pulse rounded-xl bg-slate-800/60" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 rounded-xl border border-slate-850/40 bg-[#121212]/40 p-3.5">
                  <div className="space-y-1.5">
                    <div className="h-2.5 w-20 animate-pulse rounded-full bg-slate-800" />
                    <div className="h-2 w-16 animate-pulse rounded-full bg-slate-800/60" />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-40 animate-pulse rounded-full bg-slate-800/70" />
                    <div className="h-2.5 w-28 animate-pulse rounded-full bg-slate-800/50" />
                  </div>
                  <div className="h-5 w-16 animate-pulse rounded-full bg-slate-800/60" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-850/80 bg-[#181818] p-6 shadow-md">
            <div className="space-y-2">
              <div className="h-3.5 w-44 animate-pulse rounded-full bg-slate-800" />
              <div className="h-2.5 w-32 animate-pulse rounded-full bg-slate-800/60" />
            </div>
            <div className="mt-6 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between">
                    <div className="h-2.5 w-32 animate-pulse rounded-full bg-slate-800/70" />
                    <div className="h-2.5 w-8 animate-pulse rounded-full bg-slate-800" />
                  </div>
                  <div className="h-2 w-full animate-pulse rounded-full bg-slate-800/50" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-850/80 bg-[#181818] p-6 shadow-md">
            <div className="h-3.5 w-40 animate-pulse rounded-full bg-slate-800" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between border-b border-slate-850/40 py-2">
                  <div className="h-2.5 w-28 animate-pulse rounded-full bg-slate-800/60" />
                  <div className="h-2.5 w-20 animate-pulse rounded-full bg-slate-800/70" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
