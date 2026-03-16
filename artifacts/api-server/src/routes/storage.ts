import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { eq, and } from "drizzle-orm";
import { db, projectsTable, subcontractorsTable, documentSlotsTable } from "@workspace/db";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";
import { isProjectLocked } from "../lib/projectGuards";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const pendingUploads = new Map<string, { userId: string; documentSlotId: number; expiresAt: number }>();

router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  const documentSlotId = parsed.data.documentSlotId;

  const docs = await db
    .select({ id: documentSlotsTable.id, projectId: projectsTable.id })
    .from(documentSlotsTable)
    .innerJoin(subcontractorsTable, eq(documentSlotsTable.subcontractorId, subcontractorsTable.id))
    .innerJoin(projectsTable, eq(subcontractorsTable.projectId, projectsTable.id))
    .where(and(eq(documentSlotsTable.id, documentSlotId), eq(projectsTable.userId, req.user.id)));

  if (docs.length === 0) {
    res.status(404).json({ error: "Document slot not found" });
    return;
  }

  if (await isProjectLocked(docs[0].projectId)) {
    res.status(403).json({ error: "Project is approved and locked" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    pendingUploads.set(objectPath, {
      userId: req.user.id,
      documentSlotId,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType, documentSlotId },
      }),
    );
  } catch (error) {
    console.error("Error generating upload URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

export function validateUploadIntent(objectPath: string, userId: string, documentSlotId: number): boolean {
  const intent = pendingUploads.get(objectPath);
  if (!intent) return false;
  if (intent.userId !== userId || intent.documentSlotId !== documentSlotId) return false;
  if (Date.now() > intent.expiresAt) {
    pendingUploads.delete(objectPath);
    return false;
  }
  pendingUploads.delete(objectPath);
  return true;
}

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error("Error serving public object:", error);
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const docs = await db
      .select({ id: documentSlotsTable.id })
      .from(documentSlotsTable)
      .innerJoin(subcontractorsTable, eq(documentSlotsTable.subcontractorId, subcontractorsTable.id))
      .innerJoin(projectsTable, eq(subcontractorsTable.projectId, projectsTable.id))
      .where(and(eq(documentSlotsTable.filePath, objectPath), eq(projectsTable.userId, req.user.id)));

    if (docs.length === 0) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error("Error serving object:", error);
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
