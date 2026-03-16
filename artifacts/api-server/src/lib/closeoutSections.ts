export const CLOSEOUT_PACKAGE_SECTIONS = [
  "Permits",
  "Inspection/Sign Off",
  "As-Builts",
  "Balancing Report",
  "Testing/Demonstration",
  "Equipment O&Ms",
  "Project Submittals",
  "Warranty",
  "Architectural Maintenance Instructions",
] as const;

export type CloseoutSection = (typeof CLOSEOUT_PACKAGE_SECTIONS)[number];

const SECTION_KEYWORDS: { section: CloseoutSection; patterns: string[] }[] = [
  { section: "As-Builts", patterns: ["as-built", "as built"] },
  { section: "Testing/Demonstration", patterns: ["test", "demonstration", "demo", "start up", "startup", "start-up", "hydro", "pressure test", "ansul", "acoustical test", "data test"] },
  { section: "Equipment O&Ms", patterns: ["o&m", "o&ms", "equipment o&m"] },
  { section: "Warranty", patterns: ["warranty"] },
  { section: "Architectural Maintenance Instructions", patterns: ["maintenance instruction", "architectural maintenance"] },
  { section: "Balancing Report", patterns: ["balancing report"] },
  { section: "Permits", patterns: ["permit"] },
  { section: "Inspection/Sign Off", patterns: ["inspection", "sign off", "sign-off"] },
  { section: "Project Submittals", patterns: ["submittal"] },
];

export function mapDocumentTypeToSection(documentType: string): CloseoutSection {
  const lower = documentType.toLowerCase();

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
