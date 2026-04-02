import { Router, type IRouter } from "express";
import { eq, and, sql, count } from "drizzle-orm";
import { db, projectsTable, subcontractorsTable, documentSlotsTable } from "@workspace/db";
import {
  CreateSubcontractorBody,
  CreateSubcontractorParams,
  ImportSubcontractorsParams,
  ImportSubcontractorsBody,
  DeleteSubcontractorParams,
  ListSubcontractorsParams,
} from "@workspace/api-zod";
import { getCsiDivision, buildGlobalParentLookup } from "../lib/csiDivisions";
import { isProjectLocked } from "../lib/projectGuards";

const router: IRouter = Router();

async function autoAssignDocuments(subcontractorId: number, csiCode: string) {
  const { mapDocumentTypeToSection } = await import("../lib/closeoutSections");
  const division = await getCsiDivision(csiCode);
  if (!division) return;

  const docs = division.requiredDocuments.map((req) => ({
    subcontractorId,
    documentType: req.documentType,
    parentDocumentType: req.parentDocumentType ?? null,
    packageSection: mapDocumentTypeToSection(req.documentType, req.parentDocumentType),
    status: "not_submitted" as const,
  }));

  if (docs.length > 0) {
    await db.insert(documentSlotsTable).values(docs);
  }
}

async function getSubWithProgress(sub: typeof subcontractorsTable.$inferSelect) {
  const docs = await db
    .select({
      total: count(),
      uploaded: sql<number>`count(case when ${documentSlotsTable.status} in ('uploaded', 'approved') then 1 end)`.as("uploaded"),
      approved: sql<number>`count(case when ${documentSlotsTable.status} = 'approved' then 1 end)`.as("approved"),
    })
    .from(documentSlotsTable)
    .where(eq(documentSlotsTable.subcontractorId, sub.id));

  const stats = docs[0] || { total: 0, uploaded: 0, approved: 0 };
  const division = await getCsiDivision(sub.csiCode);

  return {
    ...sub,
    csiDivision: division?.name || sub.csiCode || "Unknown",
    totalDocuments: stats.total,
    uploadedDocuments: Number(stats.uploaded),
    approvedDocuments: Number(stats.approved),
    progress: stats.total > 0 ? Math.round((Number(stats.uploaded) / stats.total) * 100) : 0,
  };
}

router.get("/subcontractors", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const subs = await db
    .select({
      id: subcontractorsTable.id,
      vendorName: subcontractorsTable.vendorName,
      vendorCode: subcontractorsTable.vendorCode,
      csiCode: subcontractorsTable.csiCode,
      projectId: subcontractorsTable.projectId,
      projectName: projectsTable.name,
    })
    .from(subcontractorsTable)
    .innerJoin(projectsTable, eq(subcontractorsTable.projectId, projectsTable.id))
    .where(eq(projectsTable.userId, req.user.id))
    .orderBy(subcontractorsTable.vendorName);

  const result = await Promise.all(subs.map(async (sub) => {
    const docs = await db
      .select({
        total: count(),
        uploaded: sql<number>`count(case when ${documentSlotsTable.status} in ('uploaded', 'approved') then 1 end)`.as("uploaded"),
        approved: sql<number>`count(case when ${documentSlotsTable.status} = 'approved' then 1 end)`.as("approved"),
      })
      .from(documentSlotsTable)
      .where(eq(documentSlotsTable.subcontractorId, sub.id));
    const stats = docs[0] || { total: 0, uploaded: 0, approved: 0 };
    const division = await getCsiDivision(sub.csiCode);
    return {
      ...sub,
      csiDivision: division?.name || sub.csiCode || "Unknown",
      totalDocuments: stats.total,
      uploadedDocuments: Number(stats.uploaded),
      approvedDocuments: Number(stats.approved),
      progress: stats.total > 0 ? Math.round((Number(stats.uploaded) / stats.total) * 100) : 0,
    };
  }));

  res.json(result);
});

router.get("/projects/:projectId/subcontractors", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = ListSubcontractorsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, params.data.projectId), eq(projectsTable.userId, req.user.id)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const subs = await db
    .select()
    .from(subcontractorsTable)
    .where(eq(subcontractorsTable.projectId, params.data.projectId))
    .orderBy(subcontractorsTable.csiCode);

  const result = await Promise.all(subs.map(getSubWithProgress));
  res.json(result);
});

router.post("/projects/:projectId/subcontractors", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = CreateSubcontractorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateSubcontractorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, params.data.projectId), eq(projectsTable.userId, req.user.id)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (await isProjectLocked(params.data.projectId)) {
    res.status(403).json({ error: "Project is approved and locked" });
    return;
  }

  const { documentTypes: customDocTypes, customTradeType, ...subFields } = parsed.data;

  const hasCsiCode = !!subFields.csiCode;
  const hasCustomTrade = !!customTradeType;

  if (!hasCsiCode && !hasCustomTrade) {
    res.status(400).json({ error: "Either csiCode or customTradeType must be provided." });
    return;
  }

  let division = null;
  if (hasCsiCode) {
    division = await getCsiDivision(subFields.csiCode!);
    if (!division) {
      res.status(400).json({ error: `Invalid CSI code: ${subFields.csiCode}. No matching trade found.` });
      return;
    }
  }

  const insertData = {
    vendorName: subFields.vendorName,
    vendorCode: subFields.vendorCode,
    csiCode: subFields.csiCode || customTradeType!,
    projectId: params.data.projectId,
  };

  const [sub] = await db
    .insert(subcontractorsTable)
    .values(insertData)
    .returning();

  if (customDocTypes && customDocTypes.length > 0) {
    const { mapDocumentTypeToSection } = await import("../lib/closeoutSections");
    const parentLookup = await buildGlobalParentLookup();
    await db.insert(documentSlotsTable).values(
      customDocTypes.map((dt) => {
        const parent = parentLookup.get(dt) ?? null;
        return {
          subcontractorId: sub.id,
          documentType: dt,
          parentDocumentType: parent,
          packageSection: mapDocumentTypeToSection(dt, parent),
          status: "not_submitted" as const,
        };
      })
    );
  } else if (division) {
    await autoAssignDocuments(sub.id, sub.csiCode);
  }

  const result = await getSubWithProgress(sub);
  res.status(201).json(result);
});

router.post("/projects/:projectId/subcontractors/import", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = ImportSubcontractorsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = ImportSubcontractorsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, params.data.projectId), eq(projectsTable.userId, req.user.id)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (await isProjectLocked(params.data.projectId)) {
    res.status(403).json({ error: "Project is approved and locked" });
    return;
  }

  const invalidCodes: string[] = [];
  for (const subData of parsed.data.subcontractors) {
    const division = await getCsiDivision(subData.csiCode);
    if (!division) {
      invalidCodes.push(subData.csiCode);
    }
  }
  if (invalidCodes.length > 0) {
    res.status(400).json({ error: `Invalid CSI codes: ${[...new Set(invalidCodes)].join(", ")}. No matching trades found.` });
    return;
  }

  const created = [];
  for (const subData of parsed.data.subcontractors) {
    const [sub] = await db
      .insert(subcontractorsTable)
      .values({ ...subData, projectId: params.data.projectId })
      .returning();
    await autoAssignDocuments(sub.id, sub.csiCode);
    const withProgress = await getSubWithProgress(sub);
    created.push(withProgress);
  }

  res.status(201).json({
    imported: created.length,
    total: parsed.data.subcontractors.length,
    subcontractors: created,
  });
});

router.delete("/projects/:projectId/subcontractors/:subcontractorId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = DeleteSubcontractorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, params.data.projectId), eq(projectsTable.userId, req.user.id)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (await isProjectLocked(params.data.projectId)) {
    res.status(403).json({ error: "Project is approved and locked" });
    return;
  }

  const [sub] = await db
    .delete(subcontractorsTable)
    .where(and(eq(subcontractorsTable.id, params.data.subcontractorId), eq(subcontractorsTable.projectId, params.data.projectId)))
    .returning();

  if (!sub) {
    res.status(404).json({ error: "Subcontractor not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
