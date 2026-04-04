export const CLOSEOUT_PACKAGE_SECTIONS = [
  "Directory",
  "Permits",
  "Inspection/Sign Off",
  "As-Builts",
  "Balancing Report",
  "Testing/Demonstration",
  "Equipment O&Ms",
  "Project Submittals",
  "Warranty",
  "Architectural Maintenance Instructions",
  "Key Acceptance",
  "Attic Stock",
] as const;

export type CloseoutSection = (typeof CLOSEOUT_PACKAGE_SECTIONS)[number];

const SECTION_KEYWORDS: { section: CloseoutSection; patterns: string[] }[] = [
  { section: "Directory", patterns: ["directory"] },
  { section: "As-Builts", patterns: ["as-built", "as built", "as-builts"] },
  { section: "Testing/Demonstration", patterns: ["test", "demonstration", "demo", "start up", "startup", "start-up", "hydro", "pressure test", "ansul", "acoustical test", "data test", "balancing", "chemical cleaning", "ansul", "factory report"] },
  { section: "Equipment O&Ms", patterns: ["o&m", "o&ms", "equipment o&m"] },
  { section: "Warranty", patterns: ["warranty"] },
  { section: "Architectural Maintenance Instructions", patterns: ["maintenance instruction", "architectural maintenance", "maintenance"] },
  { section: "Balancing Report", patterns: ["balancing report"] },
  { section: "Permits", patterns: ["permit"] },
  { section: "Inspection/Sign Off", patterns: ["inspection", "sign off", "sign-off"] },
  { section: "Project Submittals", patterns: ["submittal"] },
  { section: "Key Acceptance", patterns: ["key acceptance"] },
  { section: "Attic Stock", patterns: ["attic stock"] },
];

export function mapDocumentTypeToSection(documentType: string, parentDocumentType?: string | null): CloseoutSection {
  const lookup = parentDocumentType || documentType;
  const lower = lookup.toLowerCase();

  for (const { section, patterns } of SECTION_KEYWORDS) {
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        return section;
      }
    }
  }

  if (lower.includes("report")) return "Testing/Demonstration";

  return "Project Submittals";
}
