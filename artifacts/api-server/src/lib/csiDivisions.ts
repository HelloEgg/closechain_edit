import { db, csiDocumentRequirementsTable } from "@workspace/db";
import { count } from "drizzle-orm";

export interface CsiRequiredDocument {
  documentType: string;
  parentDocumentType: string | null;
}

export interface CsiDivisionConfig {
  code: string;
  name: string;
  requiredDocuments: CsiRequiredDocument[];
}

let cachedDivisions: CsiDivisionConfig[] | null = null;

type DocItem = string | { parent: string; children: string[] };

const TRADES: { code: string; name: string; docs: DocItem[] }[] = [
  { code: "270000", name: "Audio Visual", docs: ["As-Built", { parent: "Testing/Demonstration", children: ["AV Demonstration"] }, "Equipment O&M", "Warranty"] },
  { code: "102219", name: "Demountable Partitions", docs: ["As-Built", "Warranty", "Architectural Maintenance Instructions"] },
  { code: "102200", name: "Bathroom Partitions", docs: ["As-Built", "Warranty", "Architectural Maintenance Instructions"] },
  { code: "102226", name: "Operable Partitions", docs: ["As-Built", "Equipment O&M", { parent: "Testing/Demonstration", children: ["Folding Partition Demonstration"] }, "Warranty"] },
  { code: "096800", name: "Carpet", docs: ["Architectural Maintenance Instructions", { parent: "Warranty", children: ["Manufacturer Warranty", "Subcontractor Installation Warranty"] }] },
  { code: "260000", name: "Electric", docs: ["As-Built", { parent: "Testing/Demonstration", children: ["PDU Start Up & Factory Reports", "UPS Start Up & Factory Reports", "Switch Gear Start Up Report"] }, "Equipment O&M", "Warranty"] },
  { code: "283100", name: "Fire Alarm", docs: ["As-Built", "Warranty"] },
  { code: "098000", name: "Fabric Panel / Acoustical Wrap Panels", docs: ["As-Built", "Warranty", "Architectural Maintenance Instructions"] },
  { code: "210000", name: "Fire Protection (Sprinkler)", docs: [{ parent: "Testing/Demonstration", children: ["Fire Protection Hydro Test Report", "Pre Action Test Report"] }, { parent: "Equipment O&M", children: ["Pre Action O&Ms"] }, "As-Built", "Warranty"] },
  { code: "114000", name: "Food Service Equipment", docs: ["As-Built", "Warranty", { parent: "Testing/Demonstration", children: ["ANSUL Test"] }, "Equipment O&M"] },
  { code: "052100", name: "Steel", docs: ["As-Built", "Warranty"] },
  { code: "230000", name: "HVAC", docs: ["As-Built", { parent: "Testing/Demonstration", children: ["HVAC Equipment Start Up Reports", "HVAC Piping Pressure Test Reports", "Chemical Cleaning Report"] }, "Equipment O&M", "Warranty", "Balancing Report"] },
  { code: "230900", name: "HVAC Controls", docs: ["Equipment O&M", "Warranty", { parent: "Testing/Demonstration", children: ["Controls Demonstration"] }] },
  { code: "088000", name: "Metal & Glass", docs: ["As-Built", "Warranty", "Architectural Maintenance Instructions"] },
  { code: "064000", name: "Millwork", docs: ["As-Built", "Warranty", "Architectural Maintenance Instructions"] },
  { code: "101100", name: "Office Fronts", docs: ["As-Built", "Warranty", "Architectural Maintenance Instructions"] },
  { code: "220000", name: "Plumbing", docs: ["As-Built", "Equipment O&M", "Warranty", { parent: "Testing/Demonstration", children: ["Gas Pressure Test Report"] }] },
  { code: "096900", name: "Raised Computer Floor", docs: ["As-Built", "Equipment O&M", "Warranty"] },
  { code: "096000", name: "Flooring", docs: ["Warranty", "Architectural Maintenance Instructions"] },
  { code: "281000", name: "Security", docs: ["As-Built", "Equipment O&M", { parent: "Testing/Demonstration", children: ["Security Demonstration"] }, "Warranty"] },
  { code: "274000", name: "Telecommunications", docs: ["As-Built", "Warranty", { parent: "Testing/Demonstration", children: ["Data Test Report"] }] },
  { code: "093000", name: "Tile & Stone", docs: ["As-Built", "Warranty", "Architectural Maintenance Instructions"] },
  { code: "122000", name: "Window Treatment", docs: ["As-Built", "Warranty", "Architectural Maintenance Instructions", "Equipment O&M"] },
  { code: "265000", name: "Lighting Fixtures", docs: [{ parent: "Testing/Demonstration", children: ["Lighting Demonstrations"] }, "Equipment O&M", "Warranty"] },
  { code: "099000", name: "Paint", docs: ["Warranty", "Architectural Maintenance Instructions"] },
  { code: "097200", name: "Wallcovering", docs: ["Warranty", "Architectural Maintenance Instructions"] },
  { code: "250500", name: "Sound Masking / Acoustics", docs: ["Architectural Maintenance Instructions", "As-Built", "Equipment O&M", { parent: "Testing/Demonstration", children: ["Acoustical Test"] }] },
  { code: "092900", name: "Ceiling", docs: ["As-Built", "Warranty", "Architectural Maintenance Instructions"] },
  { code: "061000", name: "Carpentry", docs: ["As-Built", "Equipment O&M", "Warranty"] },
  { code: "102100", name: "Toilet Partitions", docs: ["As-Built", "Architectural Maintenance Instructions", "Warranty"] },
  { code: "033000", name: "Concrete", docs: ["Warranty", "As-Built"] },
  { code: "072200", name: "Roofing / Waterproofing", docs: ["Warranty"] },
];

function flattenDocs(docs: DocItem[]): { documentType: string; parentDocumentType: string | null }[] {
  const rows: { documentType: string; parentDocumentType: string | null }[] = [];
  for (const item of docs) {
    if (typeof item === "string") {
      rows.push({ documentType: item, parentDocumentType: null });
    } else {
      for (const child of item.children) {
        rows.push({ documentType: child, parentDocumentType: item.parent });
      }
    }
  }
  return rows;
}

export async function seedCsiDataIfEmpty(): Promise<void> {
  const [result] = await db.select({ total: count() }).from(csiDocumentRequirementsTable);
  if (result && result.total > 0) {
    return;
  }

  console.log("Seeding CSI document requirements...");
  const rows: { csiCode: string; divisionName: string; documentType: string; parentDocumentType: string | null }[] = [];
  for (const trade of TRADES) {
    rows.push({ csiCode: trade.code, divisionName: trade.name, documentType: "Submittal", parentDocumentType: null });
    const docRows = flattenDocs(trade.docs);
    for (const doc of docRows) {
      rows.push({ csiCode: trade.code, divisionName: trade.name, documentType: doc.documentType, parentDocumentType: doc.parentDocumentType });
    }
  }

  await db.insert(csiDocumentRequirementsTable).values(rows);
  cachedDivisions = null;
  console.log(`Seeded ${rows.length} CSI rows across ${TRADES.length} trades`);
}

export async function loadCsiDivisionsFromDb(): Promise<CsiDivisionConfig[]> {
  if (cachedDivisions) return cachedDivisions;

  const rows = await db
    .select()
    .from(csiDocumentRequirementsTable)
    .orderBy(csiDocumentRequirementsTable.csiCode, csiDocumentRequirementsTable.id);

  const map = new Map<string, CsiDivisionConfig>();
  for (const row of rows) {
    if (!map.has(row.csiCode)) {
      map.set(row.csiCode, { code: row.csiCode, name: row.divisionName, requiredDocuments: [] });
    }
    map.get(row.csiCode)!.requiredDocuments.push({
      documentType: row.documentType,
      parentDocumentType: row.parentDocumentType ?? null,
    });
  }

  cachedDivisions = Array.from(map.values());
  return cachedDivisions;
}

export async function getCsiDivision(csiCode: string): Promise<CsiDivisionConfig | undefined> {
  const divisions = await loadCsiDivisionsFromDb();
  return divisions.find((d) => d.code === csiCode);
}

export async function buildGlobalParentLookup(): Promise<Map<string, string | null>> {
  const divisions = await loadCsiDivisionsFromDb();
  const lookup = new Map<string, string | null>();
  for (const div of divisions) {
    for (const req of div.requiredDocuments) {
      if (!lookup.has(req.documentType)) {
        lookup.set(req.documentType, req.parentDocumentType ?? null);
      }
    }
  }
  return lookup;
}

export function clearCsiCache(): void {
  cachedDivisions = null;
}
