"use client";

import { useState, useRef } from "react";

interface FileUploadProps {
  onUploadError?: (error: string) => void;
  onUploaded?: (data: { url: string }) => void;
  accept?: string;
  multiple?: boolean;
  className?: string;
}

export default function FileUpload({
  onUploadError,
  onUploaded,
  accept,
  multiple = false,
  className = "",
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Upload failed" }));
        throw new Error(errorData.error || "Upload failed");
      }

      const result = await response.json();
      const successMessage = multiple
        ? `Successfully uploaded ${result.filenames.length} file(s)`
        : `Successfully uploaded ${result.filenames[0]}`;

      setUploadStatus(successMessage);

      if (onUploaded) {
        result.filenames.forEach((filename: string) => {
          // Return path relative to agent's working directory
          // Files are stored in ../agent/data relative to web app
          // Agent runs from apps/agent/, so path should be data/filename
          const url = `data/${filename}`;
          onUploaded({ url });
        });
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      setUploadStatus(`Error: ${errorMessage}`);

      if (onUploadError) {
        onUploadError(errorMessage);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`file-upload ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        accept={accept}
        multiple={multiple}
        className="hidden"
        disabled={isUploading}
      />
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={isUploading}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isUploading ? "Uploading..." : "Choose File" + (multiple ? "s" : "")}
      </button>
      {uploadStatus && (
        <p
          className={`mt-2 text-sm ${
            uploadStatus.startsWith("Error") ? "text-red-600" : "text-green-600"
          }`}
        >
          {uploadStatus}
        </p>
      )}
    </div>
  );
}
