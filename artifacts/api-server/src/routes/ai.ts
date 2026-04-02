import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, projectsTable, subcontractorsTable, documentSlotsTable } from "@workspace/db";
import { AiQueryBody } from "@workspace/api-zod";
import OpenAI from "openai";
import { loadCsiDivisionsFromDb, getCsiDivision, buildGlobalParentLookup } from "../lib/csiDivisions";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const router: IRouter = Router();

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_project",
      description: "Create a new construction project with subcontractors. Use this when the user asks you to make, create, or set up a new project.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Project name" },
          jobNumber: { type: "string", description: "Job number (optional)" },
          endDate: { type: "string", description: "End date in YYYY-MM-DD format (optional)" },
          description: { type: "string", description: "Project description (optional)" },
          subcontractors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                vendorName: { type: "string", description: "Vendor/company name" },
                tradeType: { type: "string", description: "Trade type — use the CSI division name if it matches a known trade (e.g., 'Electric', 'HVAC', 'Plumbing', 'Fire Alarm'). For unknown trades, use the custom trade type string." },
              },
              required: ["vendorName", "tradeType"],
            },
            description: "List of subcontractors to add to the project",
          },
        },
        required: ["name", "subcontractors"],
      },
    },
  },
];

async function executeCreateProject(
  userId: number,
  args: {
    name: string;
    jobNumber?: string;
    endDate?: string;
    description?: string;
    subcontractors: { vendorName: string; tradeType: string }[];
  }
): Promise<string> {
  const divisions = await loadCsiDivisionsFromDb();
  const csiLookup = new Map(divisions.map(d => [d.name.toLowerCase(), d]));

  const [project] = await db
    .insert(projectsTable)
    .values({
      name: args.name,
      jobNumber: args.jobNumber || null,
      endDate: args.endDate || null,
      description: args.description || null,
      userId,
    })
    .returning();

  const { mapDocumentTypeToSection } = await import("../lib/closeoutSections");

  const [projectLevelSub] = await db
    .insert(subcontractorsTable)
    .values({
      projectId: project.id,
      vendorName: "__PROJECT_LEVEL__",
      vendorCode: "PROJECT",
      csiCode: "000000",
    })
    .returning();

  const projectLevelDocs = [
    { documentType: "Permit", parentDocumentType: null, packageSection: mapDocumentTypeToSection("Permit") },
    { documentType: "Inspection/Sign Offs", parentDocumentType: null, packageSection: mapDocumentTypeToSection("Inspection/Sign Offs") },
  ];
  await db.insert(documentSlotsTable).values(
    projectLevelDocs.map((d) => ({
      subcontractorId: projectLevelSub.id,
      documentType: d.documentType,
      parentDocumentType: d.parentDocumentType,
      packageSection: d.packageSection,
      status: "not_submitted" as const,
    }))
  );

  const parentLookup = await buildGlobalParentLookup();
  let totalDocs = projectLevelDocs.length;
  const subResults: string[] = [];

  for (const subData of args.subcontractors) {
    const division = csiLookup.get(subData.tradeType.toLowerCase());
    const csiCode = division ? division.code : subData.tradeType;
    const vendorCode = subData.vendorName.trim().slice(0, 6).toUpperCase();

    const [sub] = await db
      .insert(subcontractorsTable)
      .values({
        projectId: project.id,
        vendorName: subData.vendorName,
        vendorCode,
        csiCode,
      })
      .returning();

    const docTypeNames = division?.requiredDocuments.map((r) => r.documentType) || [];

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

    const tradeName = division ? division.name : subData.tradeType;
    subResults.push(`${subData.vendorName} (${tradeName}) — ${docTypeNames.length} documents auto-assigned`);
  }

  return JSON.stringify({
    projectId: project.id,
    projectName: args.name,
    jobNumber: args.jobNumber || null,
    totalDocuments: totalDocs,
    subcontractors: subResults,
  });
}

router.post("/ai/query", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = AiQueryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    return;
  }

  const { question, conversationHistory } = parsed.data;

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

  const contextLines: string[] = [];
  contextLines.push("CURRENT PROJECT DATA (today: " + new Date().toDateString() + ")");
  contextLines.push("=".repeat(60));

  if (projects.length === 0) {
    contextLines.push("No projects yet.");
  } else {
    const projectIds = projects.map((p) => p.id);

    const subs = await db
      .select({
        projectId: subcontractorsTable.projectId,
        id: subcontractorsTable.id,
        vendorName: subcontractorsTable.vendorName,
        csiCode: subcontractorsTable.csiCode,
      })
      .from(subcontractorsTable)
      .where(inArray(subcontractorsTable.projectId, projectIds));

    const docStats = await db
      .select({
        projectId: subcontractorsTable.projectId,
        subcontractorId: documentSlotsTable.subcontractorId,
        documentType: documentSlotsTable.documentType,
        status: documentSlotsTable.status,
      })
      .from(documentSlotsTable)
      .innerJoin(subcontractorsTable, eq(documentSlotsTable.subcontractorId, subcontractorsTable.id))
      .where(inArray(subcontractorsTable.projectId, projectIds));

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
  }

  const divisions = await loadCsiDivisionsFromDb();
  const tradesList = divisions.map(d => `${d.name} (CSI ${d.code})`).join(", ");

  const systemPrompt = `You are Manager AI, an intelligent assistant for Closechain AI — a platform for General Contractors managing interior construction closeout packages. You have access to real-time data about the user's projects, subcontractors, and document submission statuses.

You can:
1. Answer questions about projects, subcontractors, documents, and progress using the data below.
2. Create new projects with subcontractors using the create_project tool.

When the user asks you to create/make a project, use the create_project tool. Extract the project name, job number, and vendor details from what they say. For trade types, match to known CSI trades when possible. Known trades: ${tradesList}.

Common trade aliases: "electrician" = "Electric", "plumber" = "Plumbing", "HVAC" = "HVAC", "sprinkler" = "Fire Protection (Sprinkler)", "fire alarm" = "Fire Alarm", "painter" = "Paint", "carpenter" = "Carpentry", "AV" = "Audio Visual", "tile" = "Tile & Stone", "flooring" = "Flooring", "glass" = "Metal & Glass", "ceiling" = "Ceiling", "drywall" = "Ceiling", "steel" = "Steel", "concrete" = "Concrete", "millwork" = "Millwork".

If a trade doesn't match any known CSI division, use the trade name as a custom vendor type.

After creating a project, confirm what was created with details and tell them they can view it on the dashboard.

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
      tools,
      max_tokens: 1024,
    });

    const choice = completion.choices[0];

    if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
      const toolCall = choice.message.tool_calls[0];

      if (toolCall.function.name === "create_project") {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await executeCreateProject(userId, args);

        const followUp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            ...messages,
            choice.message as any,
            {
              role: "tool",
              tool_call_id: toolCall.id,
              content: result,
            },
          ],
          max_tokens: 1024,
        });

        const content = followUp.choices[0]?.message?.content ?? "Project created successfully!";
        res.json({ content, action: "project_created" });
        return;
      }
    }

    const content = choice?.message?.content ?? "I couldn't generate a response. Please try again.";
    res.json({ content });
  } catch (err: any) {
    console.error("AI query error:", err);
    res.status(500).json({ error: "Failed to process your request" });
  }
});

export default router;
