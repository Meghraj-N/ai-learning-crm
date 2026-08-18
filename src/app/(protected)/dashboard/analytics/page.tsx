import { requireAdminContext } from "@/lib/admin";
import { AnalyticsSection, EmptyState, MetricCard, MetricGrid } from "./ui";

export default async function AnalyticsPage() {
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
              Only administrators can view analytics.
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
            Analytics
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Monitor CRM performance, learner outcomes, and platform activity.
          </p>
        </div>
      </div>

      <MetricGrid>
        <MetricCard label="Total Leads" value="—" sub="Coming soon" />
        <MetricCard label="Conversion Rate" value="—" sub="Coming soon" />
        <MetricCard label="Total Students" value="—" sub="Coming soon" />
        <MetricCard label="Completion Rate" value="—" sub="Coming soon" />
      </MetricGrid>

      <AnalyticsSection title="Reporting & Insights">
        <EmptyState message="Detailed analytics reporting is currently being upgraded to the V2 platform. Full data visualization will be available in the next release." />
      </AnalyticsSection>
    </div>
  );
}
