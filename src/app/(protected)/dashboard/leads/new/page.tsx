import Link from "next/link";
import { requireStaffContext } from "@/lib/crm";
import AccessDenied from "../../access-denied";
import LeadForm from "./lead-form";

export default async function NewLeadPage() {
  const ctx = await requireStaffContext();
  if (!ctx) {
    return <AccessDenied />;
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <Link
          href="/dashboard/leads"
          className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline"
        >
          ← Back to leads
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900">
          New lead
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Add a prospect to your pipeline. Required fields are marked.
        </p>
        <div className="mt-6 rounded-md border border-zinc-200 p-6">
          <LeadForm />
        </div>
      </div>
    </div>
  );
}