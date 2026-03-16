import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, projectsTable, subcontractorsTable, documentSlotsTable } from "@workspace/db";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const router: IRouter = Router();

router.post("/ai/query", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { question, conversationHistory } = req.body as {
    question: string;
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  const userId = req.user.id;

  const projects = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      jobNumber: projectsTable.jobNumber,
      status: projectsTable.status,
      endDate: projectsTable.endDate,
    })
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId));

  if (projects.length === 0) {
    res.json({ content: "You don't have any projects yet. Create your first project to get started!" });
    return;
  }

  const projectIds = projects.map((p) => p.id);

  const subs = await db
    .select({
      projectId: subcontractorsTable.projectId,
      id: subcontractorsTable.id,
      vendorName: subcontractorsTable.vendorName,
      csiCode: subcontractorsTable.csiCode,
    })
    .from(subcontractorsTable)
    .where(sql`${subcontractorsTable.projectId} = ANY(${sql.raw(`ARRAY[${projectIds.join(",")}]::int[]`)})`);

  const docStats = await db
    .select({
      projectId: subcontractorsTable.projectId,
      subcontractorId: documentSlotsTable.subcontractorId,
      documentType: documentSlotsTable.documentType,
      status: documentSlotsTable.status,
    })
    .from(documentSlotsTable)
    .innerJoin(subcontractorsTable, eq(documentSlotsTable.subcontractorId, subcontractorsTable.id))
    .where(sql`${subcontractorsTable.projectId} = ANY(${sql.raw(`ARRAY[${projectIds.join(",")}]::int[]`)})`);

  const contextLines: string[] = [];
  contextLines.push("CURRENT PROJECT DATA (today: " + new Date().toDateString() + ")");
  contextLines.push("=".repeat(60));

  for (const project of projects) {
    const projectSubs = subs.filter((s) => s.projectId === project.id);
    const projectDocs = docStats.filter((d) => d.projectId === project.id);

    const total = projectDocs.length;
    const uploaded = projectDocs.filter((d) => d.status === "uploaded" || d.status === "approved").length;
    const approved = projectDocs.filter((d) => d.status === "approved").length;
    const progress = total > 0 ? Math.round((uploaded / total) * 100) : 0;

    contextLines.push(`\nPROJECT: "${project.name}" (ID: ${project.id})`);
    contextLines.push(`  Status: ${project.status}`);
    if (project.jobNumber) contextLines.push(`  Job Number: ${project.jobNumber}`);
    if (project.endDate) contextLines.push(`  End Date: ${project.endDate}`);
    contextLines.push(`  Progress: ${progress}% (${uploaded}/${total} docs submitted, ${approved} approved)`);
    contextLines.push(`  Subcontractors (${projectSubs.length}):`);

    for (const sub of projectSubs) {
      const subDocs = projectDocs.filter((d) => d.subcontractorId === sub.id);
      const subTotal = subDocs.length;
      const subUploaded = subDocs.filter((d) => d.status === "uploaded" || d.status === "approved").length;
      const subApproved = subDocs.filter((d) => d.status === "approved").length;
      const missing = subDocs.filter((d) => d.status === "not_submitted").map((d) => d.documentType);

      contextLines.push(`    - ${sub.vendorName} (CSI ${sub.csiCode}): ${subUploaded}/${subTotal} docs submitted, ${subApproved} approved`);
      if (missing.length > 0) {
        contextLines.push(`      Missing: ${missing.join(", ")}`);
      }
    }
  }

  const systemPrompt = `You are Manager AI, an intelligent assistant for Closechain AI — a platform for General Contractors managing interior construction closeout packages. You have access to real-time data about the user's projects, subcontractors, and document submission statuses.

Answer the user's questions concisely and helpfully using the project data provided. When listing items, use clear formatting. If a question is outside the scope of the provided data, say so politely and suggest what they can find in the app.

${contextLines.join("\n")}`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...(conversationHistory || []),
    { role: "user", content: question.trim() },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: 1024,
  });

  const content = completion.choices[0]?.message?.content ?? "I couldn't generate a response. Please try again.";
  res.json({ content });
});

export default router;
