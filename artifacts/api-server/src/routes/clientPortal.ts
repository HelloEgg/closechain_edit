import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable, subcontractorsTable, documentSlotsTable } from "@workspace/db";
import { GetClientPortalParams } from "@workspace/api-zod";
import { getCsiDivision } from "../lib/csiDivisions";

const router: IRouter = Router();

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

      const division = getCsiDivision(sub.csiCode);
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

export default router;
