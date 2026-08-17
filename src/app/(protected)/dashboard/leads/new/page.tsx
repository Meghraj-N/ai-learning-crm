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
          className="text-sm font-medium text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors inline-flex items-center"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to leads
        </Link>
      </div>

      <Card className="bg-[#111318] border-[#272B33]">
        <CardHeader className="pb-4 border-b border-[#272B33]">
          <CardTitle className="text-xl text-[#F4F4F5]">New Lead</CardTitle>
          <CardDescription className="text-[#A1A1AA]">
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