"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Loader2, X, FileText, Link as LinkIcon, ArrowUp, ArrowDown, Plus } from "lucide-react";
import type { LessonResource } from "@/types/crm";

interface ResourceManagerProps {
  bucket: string;
  folderPath: string;
  initialResources?: LessonResource[] | null;
  maxSizeMB?: number;
}

export function ResourceManager({
  bucket,
  folderPath,
  initialResources = [],
  maxSizeMB = 50,
}: ResourceManagerProps) {
  const [resources, setResources] = useState<LessonResource[]>(initialResources ?? []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // URL input state
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlNameInput, setUrlNameInput] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createSupabaseBrowserClient();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setError(null);
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.size > maxSizeMB * 1024 * 1024) {
        throw new Error(`File size must be less than ${maxSizeMB}MB`);
      }

      setUploading(true);

      const fileExt = file.name.split('.').pop() || "bin";
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${folderPath}/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const newResource: LessonResource = {
        id: crypto.randomUUID(),
        name: file.name,
        type: "file",
        url: data.path,
        size: file.size,
        mime_type: file.type,
      };

      setResources((prev) => [...prev, newResource]);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAddUrl = () => {
    setError(null);
    if (!urlInput || !urlNameInput) {
      setError("URL and Name are required.");
      return;
    }
    
    let finalUrl = urlInput.trim();
    if (finalUrl.toLowerCase().startsWith("javascript:")) {
      setError("Invalid URL scheme.");
      return;
    }
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      finalUrl = "https://" + finalUrl;
    }

    const newResource: LessonResource = {
      id: crypto.randomUUID(),
      name: urlNameInput.trim(),
      type: "url",
      url: finalUrl,
    };

    setResources((prev) => [...prev, newResource]);
    setShowUrlInput(false);
    setUrlInput("");
    setUrlNameInput("");
  };

  const handleRemove = async (index: number) => {
    const resource = resources[index];
    
    // Optimistically remove from state
    setResources((prev) => prev.filter((_, i) => i !== index));

    // Attempt to delete from storage if it's a file
    if (resource.type === "file") {
      try {
        await supabase.storage.from(bucket).remove([resource.url]);
      } catch (err) {
        console.error("Failed to delete file from storage:", err);
        // We don't block the UI here, it might be an orphaned file but the DB reference is removed.
      }
    }
  };

  const moveResource = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === resources.length - 1) return;

    setResources((prev) => {
      const copy = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Hidden input to pass resources JSON to Server Action */}
      <input type="hidden" name="resources" value={JSON.stringify(resources)} />

      {resources.length > 0 ? (
        <div className="space-y-2">
          {resources.map((resource, i) => (
            <div
              key={resource.id}
              className="flex items-center justify-between gap-3 p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {resource.type === "file" ? (
                  <FileText className="h-5 w-5 text-[var(--color-primary)] shrink-0" />
                ) : (
                  <LinkIcon className="h-5 w-5 text-[var(--color-primary)] shrink-0" />
                )}
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {resource.name}
                  </span>
                  {resource.type === "file" && resource.size && (
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {formatSize(resource.size)}
                    </span>
                  )}
                  {resource.type === "url" && (
                    <span className="text-xs text-[var(--color-text-muted)] truncate">
                      {resource.url}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={i === 0}
                  onClick={() => moveResource(i, "up")}
                >
                  <ArrowUp size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={i === resources.length - 1}
                  onClick={() => moveResource(i, "down")}
                >
                  <ArrowDown size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-[var(--color-danger)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                  onClick={() => handleRemove(i)}
                >
                  <X size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-muted)]">
          No resources added yet.
        </div>
      )}

      {error && (
        <p className="text-sm text-[var(--color-danger)] font-medium bg-[var(--color-danger)]/10 px-3 py-2 rounded-md border border-[var(--color-danger)]/20">
          {error}
        </p>
      )}

      {showUrlInput ? (
        <div className="p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] space-y-3">
          <Input
            placeholder="Resource Title (e.g. Official Documentation)"
            value={urlNameInput}
            onChange={(e) => setUrlNameInput(e.target.value)}
          />
          <Input
            placeholder="URL (e.g. https://example.com)"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => setShowUrlInput(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddUrl}>
              Add Link
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-dashed"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {uploading ? "Uploading..." : "Upload File"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-dashed"
            onClick={() => setShowUrlInput(true)}
            disabled={uploading}
          >
            <LinkIcon className="h-4 w-4 mr-2" />
            Add External Link
          </Button>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.zip"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </div>
      )}
    </div>
  );
}
