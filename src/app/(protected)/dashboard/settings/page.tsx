import { requireAdminContext } from "@/lib/admin";
import { Info } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default async function SettingsPage() {
  const ctx = await requireAdminContext();

  if (!ctx) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            Access denied
          </h1>
          <div className="mt-8 rounded-md border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3">
            <p className="text-sm text-[var(--color-destructive)]">
              Only administrators can access settings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col pb-12 w-full animate-in fade-in duration-500 max-w-6xl mx-auto px-4 mt-8">
      <div className="flex flex-col justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            Settings
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Manage platform configuration and organization preferences.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] tracking-tight">System Settings</h2>
        <div className="mt-6">
          <EmptyState
            icon={Info}
            title="Settings currently unavailable"
            description="The settings module is being migrated to the V2 platform."
            className="min-h-[200px]"
          />
        </div>
      </div>
    </div>
  );
}
