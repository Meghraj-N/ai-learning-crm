"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Loader2, UploadCloud, X, File as FileIcon, Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import Image from "next/image";

export interface MediaUploaderProps {
  bucket: string;
  folderPath: string; // e.g. 'courses/123/thumbnail'
  accept?: string;    // e.g. 'image/jpeg, image/png, image/webp'
  onUploadSuccess: (url: string, fileDetails: { name: string; size: number; type: string }) => void;
  onUploadError?: (error: string) => void;
  existingUrl?: string | null;
  onRemove?: () => void;
  disabled?: boolean;
  type?: "image" | "video" | "document";
  maxSizeMB?: number;
}

export function MediaUploader({
  bucket,
  folderPath,
  accept,
  onUploadSuccess,
  onUploadError,
  existingUrl,
  onRemove,
  disabled,
  type = "image",
  maxSizeMB = 50,
}: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

      const fileExt = file.name.split('.').pop();
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

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      onUploadSuccess(publicUrl, {
        name: file.name,
        size: file.size,
        type: file.type
      });

    } catch (err) {
      console.error("Upload error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to upload file";
      setError(errorMessage);
      if (onUploadError) onUploadError(errorMessage);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    if (onRemove) onRemove();
  };

  return (
    <div className="space-y-4">
      {existingUrl ? (
        <div className="relative overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
          {type === "image" && (
            <div className="relative aspect-video w-full bg-black/5 flex items-center justify-center">
              <img
                src={existingUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          {type === "video" && (
            <div className="relative aspect-video w-full bg-black flex items-center justify-center">
              <video 
                src={existingUrl} 
                controls 
                className="w-full h-full object-contain"
              />
            </div>
          )}
          {type === "document" && (
            <div className="flex items-center gap-3 p-4">
              <FileIcon className="h-8 w-8 text-[var(--color-primary)]" />
              <div className="flex-1 truncate">
                <a href={existingUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-[var(--color-primary)] hover:underline truncate">
                  View Document
                </a>
              </div>
            </div>
          )}
          
          <div className="absolute top-2 right-2 flex gap-2">
            {!disabled && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleRemove}
                className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white border-0"
              >
                <X size={16} />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <label 
          className={`flex flex-col items-center justify-center w-full min-h-[160px] rounded-md border-2 border-dashed border-[var(--color-border)] transition-colors ${
            disabled ? "bg-[var(--color-surface)] cursor-not-allowed opacity-60" : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] cursor-pointer"
          }`}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {uploading ? (
              <>
                <Loader2 className="w-8 h-8 mb-4 text-[var(--color-primary)] animate-spin" />
                <p className="mb-2 text-sm text-[var(--color-text-secondary)]">
                  <span className="font-semibold">Uploading...</span>
                </p>
              </>
            ) : (
              <>
                {type === "image" && <ImageIcon className="w-8 h-8 mb-4 text-[var(--color-text-muted)]" />}
                {type === "video" && <VideoIcon className="w-8 h-8 mb-4 text-[var(--color-text-muted)]" />}
                {type === "document" && <FileIcon className="w-8 h-8 mb-4 text-[var(--color-text-muted)]" />}
                <p className="mb-2 text-sm text-[var(--color-text-secondary)]">
                  <span className="font-semibold text-[var(--color-primary)]">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {type === "image" ? "PNG, JPG or WEBP" : type === "video" ? "MP4 or WebM" : "PDF, DOCX, etc"} (Max. {maxSizeMB}MB)
                </p>
              </>
            )}
          </div>
          <input 
            ref={fileInputRef}
            id="dropzone-file" 
            type="file" 
            className="hidden" 
            accept={accept}
            onChange={handleFileChange}
            disabled={disabled || uploading}
          />
        </label>
      )}

      {error && (
        <p className="text-sm text-[var(--color-danger)] font-medium bg-[var(--color-danger)]/10 px-3 py-2 rounded-md border border-[var(--color-danger)]/20">
          {error}
        </p>
      )}
    </div>
  );
}
