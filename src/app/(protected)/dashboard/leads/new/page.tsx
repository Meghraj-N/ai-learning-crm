import Link from "next/link";
import { requireStaffContext } from "@/lib/crm";
import AccessDenied from "../../access-denied";
import LeadForm from "./lead-form";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function NewLeadPage() {
  const ctx = await requireStaffContext();
  if (!ctx) {
    return <AccessDenied />;
  }

  return (
    <div className="flex flex-1 flex-col pb-12 w-full animate-in fade-in duration-500 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard/leads"
          className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors inline-flex items-center"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to leads
        </Link>
      </div>

      <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
        <CardHeader className="pb-4 border-b border-[var(--color-border)]">
          <CardTitle className="text-xl text-[var(--color-text-primary)]">New Lead</CardTitle>
          <CardDescription className="text-[var(--color-text-secondary)]">
            Add a prospect to your pipeline. Required fields are marked.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <LeadForm />
        </CardContent>
      </Card>
    </div>
  );
}