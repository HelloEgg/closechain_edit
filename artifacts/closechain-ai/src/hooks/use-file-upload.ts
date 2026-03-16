import { useState } from "react";
import { useRequestUploadUrl } from "@workspace/api-client-react";

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const requestUrlMutation = useRequestUploadUrl();

  const uploadFile = async (file: File, documentSlotId: number) => {
    setIsUploading(true);
    try {
      const res = await requestUrlMutation.mutateAsync({
        data: {
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
          documentSlotId,
        }
      });

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
