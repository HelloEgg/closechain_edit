import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";

export async function isProjectLocked(projectId: number): Promise<boolean> {
  const [project] = await db
    .select({ status: projectsTable.status })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));
  return project?.status === "approved";
}
