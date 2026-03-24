import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable, subcontractorsTable, documentSlotsTable } from "@workspace/db";
import { GetClientPortalParams } from "@workspace/api-zod";
import { getCsiDivision } from "../lib/csiDivisions";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

router.get("/client-portal/:token", async (req, res): Promise<void> => {
  const params = GetClientPortalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.clientPortalToken, params.data.token));

  if (!project || project.status !== "approved") {
    res.status(404).json({ error: "Portal not found or not approved" });
    return;
  }

  const subs = await db
    .select()
    .from(subcontractorsTable)
    .where(eq(subcontractorsTable.projectId, project.id))
    .orderBy(subcontractorsTable.csiCode);

  let totalDocs = 0;
  let uploadedDocs = 0;
  let approvedDocs = 0;

  const subsWithDocs = await Promise.all(
    subs.map(async (sub) => {
      const docs = await db
        .select()
        .from(documentSlotsTable)
        .where(eq(documentSlotsTable.subcontractorId, sub.id))
        .orderBy(documentSlotsTable.documentType);

      const division = await getCsiDivision(sub.csiCode);
      const subTotal = docs.length;
      const subUploaded = docs.filter((d) => d.status === "uploaded" || d.status === "approved").length;
      const subApproved = docs.filter((d) => d.status === "approved").length;

      totalDocs += subTotal;
      uploadedDocs += subUploaded;
      approvedDocs += subApproved;

      return {
        vendorName: sub.vendorName,
        csiCode: sub.csiCode,
        csiDivision: division?.name || "Unknown",
        progress: subTotal > 0 ? Math.round((subUploaded / subTotal) * 100) : 0,
        documents: docs.map((d) => ({
          documentType: d.documentType,
          parentDocumentType: d.parentDocumentType ?? null,
          status: d.status,
          fileName: d.fileName,
          filePath: d.filePath,
        })),
      };
    })
  );

  res.json({
    projectName: project.name,
    clientName: project.clientName,
    description: project.description,
    address: project.address,
    progress: totalDocs > 0 ? Math.round((uploadedDocs / totalDocs) * 100) : 0,
    totalDocuments: totalDocs,
    uploadedDocuments: uploadedDocs,
    approvedDocuments: approvedDocs,
    subcontractors: subsWithDocs,
  });
});

router.get("/client-portal/:token/download/*path", async (req, res): Promise<void> => {
  const token = req.params.token;
  const raw = req.params.path;
  const objectPathSuffix = Array.isArray(raw) ? raw.join("/") : raw;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.clientPortalToken, token));

  if (!project || project.status !== "approved") {
    res.status(404).json({ error: "Portal not found" });
    return;
  }

  const docs = await db
    .select({ filePath: documentSlotsTable.filePath })
    .from(documentSlotsTable)
    .innerJoin(subcontractorsTable, eq(documentSlotsTable.subcontractorId, subcontractorsTable.id))
    .where(eq(subcontractorsTable.projectId, project.id));

  const fullObjectPath = `/objects/${objectPathSuffix}`;
  const allowed = docs.some((d) => d.filePath === fullObjectPath);
  if (!allowed) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  try {
    const result = await objectStorageService.downloadObjectDirect(fullObjectPath);
    if (!result) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Length", result.data.length);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(result.data);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    console.error("Error serving portal download:", error);
    res.status(500).json({ error: "Failed to download file" });
  }
});

export default router;
