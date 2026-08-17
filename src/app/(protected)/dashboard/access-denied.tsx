export default function AccessDenied() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Access denied
        </h1>
        <div className="mt-8 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">
            You do not have permission to view this area. If you believe this
            is an error, contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}