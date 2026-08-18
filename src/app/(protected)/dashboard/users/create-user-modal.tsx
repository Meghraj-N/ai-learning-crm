"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createUser } from "./actions";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";

export function CreateUserModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const result = await createUser({ ok: false, error: null }, formData);
      if (!result.ok) {
        setError(result.error ?? "An unexpected error occurred.");
      } else {
        setOpen(false);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
      >
        Add User
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Create New User
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            
            <form action={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <label htmlFor="fullName" className="block text-[13px] font-medium text-[var(--color-text-primary)]">
                  Full Name
                </label>
                <Input
                  id="fullName"
                  name="fullName"
                  required
                  className="bg-[var(--color-surface-elevated)] border-[var(--color-border)] text-[var(--color-text-primary)]"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="email" className="block text-[13px] font-medium text-[var(--color-text-primary)]">
                  Email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="bg-[var(--color-surface-elevated)] border-[var(--color-border)] text-[var(--color-text-primary)]"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="password" className="block text-[13px] font-medium text-[var(--color-text-primary)]">
                  Password
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  className="bg-[var(--color-surface-elevated)] border-[var(--color-border)] text-[var(--color-text-primary)]"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-[13px] font-medium text-[var(--color-text-primary)]">
                  Confirm Password
                </label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={6}
                  className="bg-[var(--color-surface-elevated)] border-[var(--color-border)] text-[var(--color-text-primary)]"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="role" className="block text-[13px] font-medium text-[var(--color-text-primary)]">
                  Role
                </label>
                <select
                  id="role"
                  name="role"
                  defaultValue="student"
                  required
                  className="flex h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="student">Student</option>
                  <option value="instructor">Instructor</option>
                  <option value="sales">Sales</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              {error && (
                <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/10 p-3 rounded-md border border-[var(--color-danger)]/20">
                  {error}
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
