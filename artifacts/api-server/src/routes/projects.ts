import { Router, type IRouter } from "express";
import { eq, sql, and, count } from "drizzle-orm";
import { db, projectsTable, subcontractorsTable, documentSlotsTable } from "@workspace/db";
import {
  CreateProjectBody,
  UpdateProjectBody,
  GetProjectParams,
  UpdateProjectParams,
  DeleteProjectParams,
  ApproveProjectParams,
  SetupProjectBody,
} from "@workspace/api-zod";
import crypto from "crypto";
import { isProjectLocked } from "../lib/projectGuards";
import { loadCsiDivisionsFromDb, getCsiDivision } from "../lib/csiDivisions";

const router: IRouter = Router();

async function getProjectProgress(projectId: number) {
  const result = await db
    .select({
      total: count(),
      uploaded: sql<number>`count(case when ${documentSlotsTable.status} in ('uploaded', 'approved') then 1 end)`.as("uploaded"),
      approved: sql<number>`count(case when ${documentSlotsTable.status} = 'approved' then 1 end)`.as("approved"),
    })
    .from(documentSlotsTable)
    .innerJoin(subcontractorsTable, eq(documentSlotsTable.subcontractorId, subcontractorsTable.id))
    .where(eq(subcontractorsTable.projectId, projectId));

  const stats = result[0] || { total: 0, uploaded: 0, approved: 0 };
  return {
    totalDocuments: stats.total,
    uploadedDocuments: Number(stats.uploaded),
    approvedDocuments: Number(stats.approved),
    progress: stats.total > 0 ? Math.round((Number(stats.uploaded) / stats.total) * 100) : 0,
  };
}

router.get("/projects", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const projects = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.userId, req.user.id))
    .orderBy(projectsTable.createdAt);

  const projectsWithProgress = await Promise.all(
    projects.map(async (p) => {
      const progress = await getProjectProgress(p.id);
      return { ...p, ...progress };
    })
  );

  res.json(projectsWithProgress);
});

router.post("/projects/setup", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = SetupProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { subcontractors: subsData, ...projectData } = parsed.data;

  const divisions = await loadCsiDivisionsFromDb();
  const csiLookup = new Map(divisions.map(d => [d.code, d]));
  for (const subData of subsData) {
    const division = csiLookup.get(subData.csiCode);
    if (!division) {
      res.status(400).json({ error: `Invalid CSI code: ${subData.csiCode}` });
      return;
    }
  }

  const [project] = await db
    .insert(projectsTable)
    .values({ ...projectData, userId: req.user.id })
    .returning();

  let totalDocs = 0;
  for (const subData of subsData) {
    const [sub] = await db
      .insert(subcontractorsTable)
      .values({
        projectId: project.id,
        vendorName: subData.vendorName,
        vendorCode: subData.vendorCode || "",
        csiCode: subData.csiCode,
      })
      .returning();

    const division = csiLookup.get(subData.csiCode);
    const { mapDocumentTypeToSection } = await import("../lib/closeoutSections");
    const parentLookup = new Map<string, string | null>();
    if (division) {
      for (const req of division.requiredDocuments) {
        parentLookup.set(req.documentType, req.parentDocumentType ?? null);
      }
    }

    const docTypeNames = subData.documentTypes.length > 0
      ? subData.documentTypes
      : (division?.requiredDocuments.map((r) => r.documentType) || []);

    if (docTypeNames.length > 0) {
      await db.insert(documentSlotsTable).values(
        docTypeNames.map((dt) => {
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
      totalDocs += docTypeNames.length;
    }
  }

  res.status(201).json({ ...project, totalDocuments: totalDocs, uploadedDocuments: 0, approvedDocuments: 0, progress: 0 });
});

router.post("/projects", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [project] = await db
    .insert(projectsTable)
    .values({ ...parsed.data, userId: req.user.id })
    .returning();

  res.status(201).json({ ...project, totalDocuments: 0, uploadedDocuments: 0, approvedDocuments: 0, progress: 0 });
});

router.get("/projects/:projectId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = GetProjectParams.safeParse(req.params);
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

  const progress = await getProjectProgress(project.id);

  const subs = await db
    .select()
    .from(subcontractorsTable)
    .where(eq(subcontractorsTable.projectId, project.id))
    .orderBy(subcontractorsTable.csiCode);

  const subsWithProgress = await Promise.all(
    subs.map(async (sub) => {
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
        csiDivision: division?.name || "Unknown",
        totalDocuments: stats.total,
        uploadedDocuments: Number(stats.uploaded),
        approvedDocuments: Number(stats.approved),
        progress: stats.total > 0 ? Math.round((Number(stats.uploaded) / stats.total) * 100) : 0,
      };
    })
  );

  res.json({ ...project, ...progress, subcontractors: subsWithProgress });
});

router.patch("/projects/:projectId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (await isProjectLocked(params.data.projectId)) {
    res.status(403).json({ error: "Project is approved and locked" });
    return;
  }

  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [project] = await db
    .update(projectsTable)
    .set(parsed.data)
    .where(and(eq(projectsTable.id, params.data.projectId), eq(projectsTable.userId, req.user.id)))
    .returning();

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const progress = await getProjectProgress(project.id);
  res.json({ ...project, ...progress });
});

router.delete("/projects/:projectId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (await isProjectLocked(params.data.projectId)) {
    res.status(403).json({ error: "Project is approved and locked" });
    return;
  }

  const [project] = await db
    .delete(projectsTable)
    .where(and(eq(projectsTable.id, params.data.projectId), eq(projectsTable.userId, req.user.id)))
    .returning();

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/projects/:projectId/approve", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = ApproveProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, params.data.projectId), eq(projectsTable.userId, req.user.id)));

  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const token = existing.clientPortalToken || crypto.randomBytes(32).toString("hex");

  const [project] = await db
    .update(projectsTable)
    .set({ status: "approved", clientPortalToken: token })
    .where(eq(projectsTable.id, params.data.projectId))
    .returning();

  res.json({
    clientPortalToken: project.clientPortalToken,
    clientPortalUrl: `/client-portal/${project.clientPortalToken}`,
  });
});

export default router;
