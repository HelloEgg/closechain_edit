import { useState } from "react";

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (file: File, documentSlotId: number) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentSlotId", String(documentSlotId));

      const res = await fetch("/api/storage/uploads/direct", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Upload failed with status: ${res.status}`);
      }

      const data = await res.json();
      return {
        objectPath: data.objectPath,
        fileName: data.fileName || file.name,
      };
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadFile,
    isUploading,
  };
}
