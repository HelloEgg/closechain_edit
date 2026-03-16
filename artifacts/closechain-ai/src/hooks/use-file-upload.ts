import { useState } from "react";
import { useRequestUploadUrl } from "@workspace/api-client-react";

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const requestUrlMutation = useRequestUploadUrl();

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      // 1. Get presigned URL and object path
      const res = await requestUrlMutation.mutateAsync({
        data: {
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }
      });

      // 2. Upload directly to GCS via the presigned URL
      const uploadRes = await fetch(res.uploadURL, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed with status: ${uploadRes.status}`);
      }

      // Return the details needed to save in the database
      return {
        objectPath: res.objectPath,
        fileName: file.name,
      };
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadFile,
    isUploading: isUploading || requestUrlMutation.isPending,
  };
}
