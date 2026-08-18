"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function CoursesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Courses route error:", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 animate-in fade-in duration-500">
      <div className="max-w-md w-full text-center space-y-6 bg-[var(--color-surface)] border border-[var(--color-border)] p-8 rounded-[var(--radius-xl)] shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20">
          <AlertCircle className="h-8 w-8 text-[var(--color-danger)]" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            Courses unavailable
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            We couldn&apos;t load your course directory right now. Please try again. If the problem continues, contact your administrator.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button 
            onClick={reset}
            className="w-full sm:w-auto bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90"
          >
            Try again
          </Button>
          <Button 
            variant="outline"
            onClick={() => router.push("/dashboard")}
            className="w-full sm:w-auto border-[var(--color-border)] text-[var(--color-text-primary)]"
          >
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
