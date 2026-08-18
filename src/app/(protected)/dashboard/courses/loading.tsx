export default function CoursesLoading() {
  return (
    <div className="flex flex-1 justify-center px-4 py-8">
      <div className="w-full max-w-6xl">
        <div className="h-8 w-40 animate-pulse rounded-md bg-[var(--color-surface-elevated)]" />
        <div className="mt-6 h-10 w-full animate-pulse rounded-md bg-[var(--color-surface)]" />
        <div className="mt-6 h-64 w-full animate-pulse rounded-md bg-[var(--color-surface)]" />
      </div>
    </div>
  );
}
