import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, projectsTable, subcontractorsTable, documentSlotsTable } from "@workspace/db";
import { GetClientPortalParams, AiQueryBody } from "@workspace/api-zod";
import { getCsiDivision } from "../lib/csiDivisions";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import archiver from "archiver";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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

router.get("/client-portal/:token/download-all", async (req, res): Promise<void> => {
  const params = GetClientPortalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const token = params.data.token;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.clientPortalToken, token));

  if (!project || project.status !== "approved") {
    res.status(404).json({ error: "Portal not found or not approved" });
    return;
  }

  const subs = await db
    .select()
    .from(subcontractorsTable)
    .where(eq(subcontractorsTable.projectId, project.id))
    .orderBy(subcontractorsTable.csiCode);

  const subsWithDocs = await Promise.all(
    subs.map(async (sub) => {
      const docs = await db
        .select()
        .from(documentSlotsTable)
        .where(eq(documentSlotsTable.subcontractorId, sub.id))
        .orderBy(documentSlotsTable.documentType);

      const division = await getCsiDivision(sub.csiCode);
      return { sub, division, docs };
    })
  );

  const docsWithFiles = subsWithDocs.flatMap(({ sub, division, docs }) =>
    docs
      .filter((d) => d.filePath)
      .map((d) => ({
        filePath: d.filePath!,
        fileName: d.fileName || "document",
        documentType: d.documentType,
        parentDocumentType: d.parentDocumentType,
        packageSection: d.packageSection || "General",
        vendorName: sub.vendorName,
        csiCode: sub.csiCode,
        divisionName: division?.name || "Unknown",
      }))
  );

  if (docsWithFiles.length === 0) {
    res.status(404).json({ error: "No documents available for download" });
    return;
  }

  const sanitize = (name: string) => name.replace(/[<>:"/\\|?*]/g, "_").trim();
  const projectFolder = sanitize(project.name);

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${projectFolder} - Closeout Package.zip"`
  );

  const archive = archiver("zip", { zlib: { level: 5 } });
  archive.on("error", (err) => {
    console.error("Archive error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to create archive" });
    }
  });
  archive.pipe(res);

  for (const doc of docsWithFiles) {
    try {
      const result = await objectStorageService.downloadObjectDirect(doc.filePath);
      if (!result) continue;

      const ext = doc.fileName.includes(".") ? "" : ".pdf";
      const docTypeFolder = sanitize(doc.parentDocumentType || doc.documentType);
      const subDocTypeFolder = doc.parentDocumentType ? sanitize(doc.documentType) : "";
      const vendorFolder = sanitize(doc.vendorName);
      const fileName = sanitize(doc.fileName) + ext;

      const pathParts = [projectFolder, docTypeFolder];
      if (subDocTypeFolder) pathParts.push(subDocTypeFolder);
      pathParts.push(vendorFolder, fileName);
      const archivePath = pathParts.join("/");

      archive.append(result.data, { name: archivePath });
    } catch (err) {
      console.warn(`Skipping file ${doc.filePath}:`, err);
    }
  }

  await archive.finalize();
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

router.post("/client-portal/:token/ai/query", async (req, res): Promise<void> => {
  const params = GetClientPortalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AiQueryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    return;
  }

  const { question, conversationHistory } = parsed.data;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.clientPortalToken, params.data.token));

  if (!project || project.status !== "approved") {
    res.status(404).json({ error: "Portal not found or not approved" });
    return;
  }

  const subs = await db
    .select({
      id: subcontractorsTable.id,
      vendorName: subcontractorsTable.vendorName,
      csiCode: subcontractorsTable.csiCode,
    })
    .from(subcontractorsTable)
    .where(eq(subcontractorsTable.projectId, project.id));

  const subIds = subs.map((s) => s.id);

  let docStats: { subcontractorId: number; documentType: string; parentDocumentType: string | null; status: string; fileName: string | null }[] = [];
  if (subIds.length > 0) {
    docStats = await db
      .select({
        subcontractorId: documentSlotsTable.subcontractorId,
        documentType: documentSlotsTable.documentType,
        parentDocumentType: documentSlotsTable.parentDocumentType,
        status: documentSlotsTable.status,
        fileName: documentSlotsTable.fileName,
      })
      .from(documentSlotsTable)
      .where(inArray(documentSlotsTable.subcontractorId, subIds));
  }

  const contextLines: string[] = [];
  contextLines.push("PROJECT DATA (today: " + new Date().toDateString() + ")");
  contextLines.push("=".repeat(60));
  
  const total = docStats.length;
  const uploaded = docStats.filter((d) => d.status === "uploaded" || d.status === "approved").length;
  const approved = docStats.filter((d) => d.status === "approved").length;
  const progress = total > 0 ? Math.round((uploaded / total) * 100) : 0;

  contextLines.push(`PROJECT: "${project.name}"`);
  if (project.clientName) contextLines.push(`  Client: ${project.clientName}`);
  if (project.description) contextLines.push(`  Description: ${project.description}`);
  if (project.address) contextLines.push(`  Address: ${project.address}`);
  if (project.jobNumber) contextLines.push(`  Job Number: ${project.jobNumber}`);
  if (project.endDate) contextLines.push(`  End Date: ${project.endDate}`);
  contextLines.push(`  Overall Progress: ${progress}% (${uploaded}/${total} docs submitted, ${approved} approved)`);
  contextLines.push(`  Subcontractors (${subs.length}):`);

  for (const sub of subs) {
    const subDocs = docStats.filter((d) => d.subcontractorId === sub.id);
    const subTotal = subDocs.length;
    const subUploaded = subDocs.filter((d) => d.status === "uploaded" || d.status === "approved").length;
    const subApproved = subDocs.filter((d) => d.status === "approved").length;

    contextLines.push(`    - ${sub.vendorName} (CSI ${sub.csiCode}): ${subUploaded}/${subTotal} docs submitted, ${subApproved} approved`);
    contextLines.push(`      Documents:`);
    for (const doc of subDocs) {
      const parentLabel = doc.parentDocumentType ? ` (under ${doc.parentDocumentType})` : "";
      contextLines.push(`        - ${doc.documentType}${parentLabel}: ${doc.status}${doc.fileName ? ` [file: ${doc.fileName}]` : ""}`);
    }
  }

  const systemPrompt = `You are the Closechain Agent, an intelligent assistant embedded in the client portal for the project "${project.name}". You help clients understand the status of their closeout package.

The user is already viewing the client portal for "${project.name}" — they do NOT need to tell you which project they are asking about. Every question they ask is about this project. Never ask them to specify a project name.

You have full access to this project's real-time data below, including all subcontractors, their document submission statuses, document types (warranties, permits, as-builts, O&Ms, testing reports, etc.), and overall progress. Use this data to answer questions thoroughly.

When a user asks about specific document types (e.g. "how many warranties do I have?"), look through ALL subcontractors' document lists in the data below and find matches. The documentType field contains the type name (e.g. "Warranty", "As-Built Drawings", etc.).

If a question is genuinely outside the scope of construction closeout packages or this project's data, politely let them know.

Answer concisely and helpfully. When listing items, use clear formatting.

${contextLines.join("\n")}`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...(conversationHistory || []),
    { role: "user", content: question.trim() },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 1024,
    });

    const content = completion.choices[0]?.message?.content ?? "I couldn't generate a response. Please try again.";
    res.json({ content });
  } catch (err) {
    console.error("Client portal AI query error:", err);
    res.status(500).json({ error: "Failed to generate AI response" });
  }
});

export default router;
