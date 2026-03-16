import { Router, type IRouter } from "express";
import { eq, and, sql, count, inArray } from "drizzle-orm";
import { db, projectsTable, subcontractorsTable, documentSlotsTable } from "@workspace/db";
import {
  ListDocumentSlotsParams,
  AddDocumentSlotParams,
  AddDocumentSlotBody,
  UpdateDocumentSlotParams,
  UpdateDocumentSlotBody,
  DeleteDocumentSlotParams,
  ListAllProjectDocumentsParams,
  ListAllProjectDocumentsQueryParams,
} from "@workspace/api-zod";
import { isProjectLocked } from "../lib/projectGuards";

const router: IRouter = Router();

async function verifyProjectOwnership(userId: string, projectId: number): Promise<boolean> {
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
  return !!project;
}

async function verifySubBelongsToProject(subcontractorId: number, projectId: number): Promise<boolean> {
  const [sub] = await db
    .select({ id: subcontractorsTable.id })
    .from(subcontractorsTable)
    .where(and(eq(subcontractorsTable.id, subcontractorId), eq(subcontractorsTable.projectId, projectId)));
  return !!sub;
}

router.get("/projects/:projectId/subcontractors/:subcontractorId/documents", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = ListDocumentSlotsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (!(await verifyProjectOwnership(req.user.id, params.data.projectId))) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (!(await verifySubBelongsToProject(params.data.subcontractorId, params.data.projectId))) {
    res.status(404).json({ error: "Subcontractor not found in this project" });
    return;
  }

  const docs = await db
    .select()
    .from(documentSlotsTable)
    .where(eq(documentSlotsTable.subcontractorId, params.data.subcontractorId))
    .orderBy(documentSlotsTable.documentType);

  res.json(docs);
});

router.post("/projects/:projectId/subcontractors/:subcontractorId/documents", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = AddDocumentSlotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (!(await verifyProjectOwnership(req.user.id, params.data.projectId))) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (!(await verifySubBelongsToProject(params.data.subcontractorId, params.data.projectId))) {
    res.status(404).json({ error: "Subcontractor not found in this project" });
    return;
  }

  if (await isProjectLocked(params.data.projectId)) {
    res.status(403).json({ error: "Project is approved and locked" });
    return;
  }

  const parsed = AddDocumentSlotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [doc] = await db
    .insert(documentSlotsTable)
    .values({
      subcontractorId: params.data.subcontractorId,
      documentType: parsed.data.documentType,
      status: "not_submitted",
    })
    .returning();

  res.status(201).json(doc);
});

async function verifyDocSlotOwnership(userId: string, documentSlotId: number): Promise<{ owned: boolean; projectId: number | null }> {
  const result = await db
    .select({ id: documentSlotsTable.id, projectId: projectsTable.id })
    .from(documentSlotsTable)
    .innerJoin(subcontractorsTable, eq(documentSlotsTable.subcontractorId, subcontractorsTable.id))
    .innerJoin(projectsTable, eq(subcontractorsTable.projectId, projectsTable.id))
    .where(and(eq(documentSlotsTable.id, documentSlotId), eq(projectsTable.userId, userId)));
  return { owned: result.length > 0, projectId: result[0]?.projectId ?? null };
}

router.patch("/documents/:documentSlotId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = UpdateDocumentSlotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDocumentSlotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const ownership = await verifyDocSlotOwnership(req.user.id, params.data.documentSlotId);
  if (!ownership.owned) {
    res.status(404).json({ error: "Document slot not found" });
    return;
  }

  if (ownership.projectId && await isProjectLocked(ownership.projectId)) {
    res.status(403).json({ error: "Project is approved and locked" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.status) updateData.status = parsed.data.status;
  if (parsed.data.filePath) updateData.filePath = parsed.data.filePath;
  if (parsed.data.fileName) updateData.fileName = parsed.data.fileName;
  if (parsed.data.filePath || parsed.data.fileName) updateData.uploadedAt = new Date();

  const [doc] = await db
    .update(documentSlotsTable)
    .set(updateData)
    .where(eq(documentSlotsTable.id, params.data.documentSlotId))
    .returning();

  if (!doc) {
    res.status(404).json({ error: "Document slot not found" });
    return;
  }

  res.json(doc);
});

router.delete("/documents/:documentSlotId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = DeleteDocumentSlotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const ownership2 = await verifyDocSlotOwnership(req.user.id, params.data.documentSlotId);
  if (!ownership2.owned) {
    res.status(404).json({ error: "Document slot not found" });
    return;
  }

  if (ownership2.projectId && await isProjectLocked(ownership2.projectId)) {
    res.status(403).json({ error: "Project is approved and locked" });
    return;
  }

  const [doc] = await db
    .delete(documentSlotsTable)
    .where(eq(documentSlotsTable.id, params.data.documentSlotId))
    .returning();

  if (!doc) {
    res.status(404).json({ error: "Document slot not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/projects/:projectId/documents", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = ListAllProjectDocumentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (!(await verifyProjectOwnership(req.user.id, params.data.projectId))) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const queryParams = ListAllProjectDocumentsQueryParams.safeParse(req.query);

  let query = db
    .select({
      id: documentSlotsTable.id,
      subcontractorId: documentSlotsTable.subcontractorId,
      documentType: documentSlotsTable.documentType,
      status: documentSlotsTable.status,
      filePath: documentSlotsTable.filePath,
      fileName: documentSlotsTable.fileName,
      uploadedAt: documentSlotsTable.uploadedAt,
      vendorName: subcontractorsTable.vendorName,
      csiCode: subcontractorsTable.csiCode,
      createdAt: documentSlotsTable.createdAt,
    })
    .from(documentSlotsTable)
    .innerJoin(subcontractorsTable, eq(documentSlotsTable.subcontractorId, subcontractorsTable.id))
    .where(eq(subcontractorsTable.projectId, params.data.projectId))
    .orderBy(subcontractorsTable.csiCode, documentSlotsTable.documentType);

  const results = await query;

  let filtered = results;
  if (queryParams.success && queryParams.data.status) {
    filtered = filtered.filter((d) => d.status === queryParams.data.status);
  }
  if (queryParams.success && queryParams.data.documentType) {
    filtered = filtered.filter((d) =>
      d.documentType.toLowerCase().includes(queryParams.data.documentType!.toLowerCase())
    );
  }

  res.json(filtered);
});

export default router;
