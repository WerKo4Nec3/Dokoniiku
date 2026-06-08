export function JourneySkeleton() {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl animate-pulse content-center gap-8 px-4 py-24 sm:px-6">
      <div className="mx-auto h-28 w-28 rounded-full bg-[color:var(--surface-muted)]" />
      <div className="mx-auto h-8 w-56 rounded bg-[color:var(--surface-muted)]" />
      <div className="grid gap-5 md:grid-cols-[1.15fr_.85fr]">
        <div className="h-80 rounded-lg bg-[color:var(--surface-muted)]" />
        <div className="space-y-4">
          <div className="h-24 rounded-lg bg-[color:var(--surface-muted)]" />
          <div className="h-24 rounded-lg bg-[color:var(--surface-muted)]" />
          <div className="h-12 rounded-lg bg-[color:var(--surface-muted)]" />
        </div>
      </div>
    </div>
  );
}
