import { db, csiDocumentRequirementsTable } from "@workspace/db";

export interface ActiveSection {
  num: number;
  folderName: string;
  docType: string | null;
}

const CANONICAL_SECTIONS: { folderName: string; matchKeys: string[] }[] = [
  { folderName: "Directory", matchKeys: ["directory"] },
  { folderName: "Permits", matchKeys: ["permit"] },
  { folderName: "Inspections & Sign-Offs", matchKeys: ["inspection", "sign off", "sign-off"] },
  { folderName: "As-Builts", matchKeys: ["as-built", "as built"] },
  { folderName: "Balancing Reports", matchKeys: ["balancing"] },
  { folderName: "Testing & Demonstrations", matchKeys: ["testing", "demonstration"] },
  { folderName: "Equipment O&M's", matchKeys: ["equipment", "o&m"] },
  { folderName: "Project Submittals", matchKeys: ["submittal"] },
  { folderName: "Warranties", matchKeys: ["warranty"] },
  { folderName: "Architectural Maintenance Instructions", matchKeys: ["architectural", "maintenance instruction"] },
  { folderName: "Key Acceptance", matchKeys: ["key acceptance"] },
  { folderName: "Attic Stock", matchKeys: ["attic stock"] },
  { folderName: "Punchlist Signoff", matchKeys: ["punchlist"] },
  { folderName: "Close-out Acceptance (STI Use Only)", matchKeys: ["close-out", "closeout", "close out"] },
];

const NON_DIRECTORY_SECTIONS = CANONICAL_SECTIONS.filter(
  (s) => s.folderName !== "Directory",
);

const PROJECT_LEVEL_TYPES = new Set([
  "directory",
  "permit",
  "inspection/sign offs",
  "inspection/sign off",
  "key acceptance",
  "attic stock",
  "punchlist signoff",
  "close-out acceptance",
]);

const ALWAYS_INCLUDE_FOLDERS = new Set([
  "Permits",
  "Inspections & Sign-Offs",
]);

function matchCanonical(
  docType: string,
): (typeof CANONICAL_SECTIONS)[number] | undefined {
  const lower = docType.toLowerCase();
  return CANONICAL_SECTIONS.find((s) =>
    s.matchKeys.some((key) => lower.includes(key)),
  );
}

function isKnownStandardType(
  docType: string,
  knownCsiDocTypes: Set<string>,
): boolean {
  return knownCsiDocTypes.has(docType.toLowerCase());
}

export async function loadKnownCsiDocTypes(): Promise<Set<string>> {
  const rows = await db.select().from(csiDocumentRequirementsTable);
  const types = new Set<string>();
  for (const row of rows) {
    types.add(row.documentType.toLowerCase());
  }
  for (const pt of PROJECT_LEVEL_TYPES) {
    types.add(pt.toLowerCase());
  }
  return types;
}

export function buildActiveSections(
  sortedDocTypes: string[],
  projectLevelDocTypes: Set<string>,
  knownCsiDocTypes: Set<string>,
): ActiveSection[] {
  const sections: ActiveSection[] = [];
  const placed = new Set<string>();

  for (const canonical of NON_DIRECTORY_SECTIONS) {
    let matched = false;
    let matchedDocType: string | null = null;

    for (const dt of sortedDocTypes) {
      if (placed.has(dt)) continue;
      if (!isKnownStandardType(dt, knownCsiDocTypes)) continue;

      const match = matchCanonical(dt);
      if (match && match.folderName === canonical.folderName) {
        matched = true;
        matchedDocType = dt;
        placed.add(dt);
        break;
      }
    }

    if (!matched) {
      for (const dt of projectLevelDocTypes) {
        if (placed.has(dt)) continue;
        const match = matchCanonical(dt);
        if (match && match.folderName === canonical.folderName) {
          matched = true;
          matchedDocType = dt;
          placed.add(dt);
          break;
        }
      }
    }

    if (matched || ALWAYS_INCLUDE_FOLDERS.has(canonical.folderName)) {
      sections.push({
        num: 0,
        folderName: canonical.folderName,
        docType: matchedDocType,
      });
    }
  }

  for (const dt of sortedDocTypes) {
    if (placed.has(dt)) continue;
    sections.push({
      num: 0,
      folderName: dt,
      docType: dt,
    });
  }

  for (let i = 0; i < sections.length; i++) {
    sections[i].num = i + 2;
  }

  return sections;
}

export function canonicalFolderName(section: ActiveSection): string {
  const num = String(section.num).padStart(2, "0");
  return `${num}-${section.folderName}`;
}

export function sortDocTypes(
  keys: string[],
  knownCsiDocTypes: Set<string>,
): string[] {
  const known: string[] = [];
  const custom: string[] = [];

  for (const key of keys) {
    if (isKnownStandardType(key, knownCsiDocTypes)) {
      known.push(key);
    } else {
      custom.push(key);
    }
  }

  known.sort((a, b) => {
    const idxA = CANONICAL_SECTIONS.findIndex((s) =>
      s.matchKeys.some((k) => a.toLowerCase().includes(k)),
    );
    const idxB = CANONICAL_SECTIONS.findIndex((s) =>
      s.matchKeys.some((k) => b.toLowerCase().includes(k)),
    );
    const orderA = idxA === -1 ? CANONICAL_SECTIONS.length : idxA;
    const orderB = idxB === -1 ? CANONICAL_SECTIONS.length : idxB;
    return orderA - orderB;
  });

  custom.sort((a, b) => a.localeCompare(b));

  return [...known, ...custom];
}
