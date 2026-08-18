"use client";

import { Button } from "@/components/ui/button";

export function RetryButton({ children }: { children?: React.ReactNode }) {
  return (
    <Button onClick={() => window.location.reload()}>
      {children || <span>Try again</span>}
    </Button>
  );
}
