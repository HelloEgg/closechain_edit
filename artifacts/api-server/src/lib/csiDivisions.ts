import { db, csiDocumentRequirementsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface CsiDivisionConfig {
  code: string;
  name: string;
  requiredDocuments: string[];
}

let cachedDivisions: CsiDivisionConfig[] | null = null;

export async function loadCsiDivisionsFromDb(): Promise<CsiDivisionConfig[]> {
  if (cachedDivisions) return cachedDivisions;

  const rows = await db
    .select()
    .from(csiDocumentRequirementsTable)
    .orderBy(csiDocumentRequirementsTable.csiCode, csiDocumentRequirementsTable.documentType);

  const map = new Map<string, CsiDivisionConfig>();
  for (const row of rows) {
    if (!map.has(row.csiCode)) {
      map.set(row.csiCode, { code: row.csiCode, name: row.divisionName, requiredDocuments: [] });
    }
    map.get(row.csiCode)!.requiredDocuments.push(row.documentType);
  }

  cachedDivisions = Array.from(map.values());
  return cachedDivisions;
}

export async function getCsiDivision(csiCode: string): Promise<CsiDivisionConfig | undefined> {
  const divisions = await loadCsiDivisionsFromDb();
  return divisions.find((d) => d.code === csiCode);
}

export function clearCsiCache(): void {
  cachedDivisions = null;
}
