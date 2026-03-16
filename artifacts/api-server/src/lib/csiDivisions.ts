export interface CsiDivisionConfig {
  code: string;
  name: string;
  requiredDocuments: string[];
}

export const CSI_DIVISIONS: CsiDivisionConfig[] = [
  {
    code: "02",
    name: "Existing Conditions",
    requiredDocuments: ["As-Built Drawings", "Warranty", "Test Reports"],
  },
  {
    code: "03",
    name: "Concrete",
    requiredDocuments: ["As-Built Drawings", "Warranty", "Test Reports", "Mix Design Submittals", "Inspection Reports"],
  },
  {
    code: "04",
    name: "Masonry",
    requiredDocuments: ["As-Built Drawings", "Warranty", "Test Reports", "Material Certifications"],
  },
  {
    code: "05",
    name: "Metals",
    requiredDocuments: ["As-Built Drawings", "Warranty", "Shop Drawings", "Material Certifications", "Welding Certifications"],
  },
  {
    code: "06",
    name: "Wood, Plastics, and Composites",
    requiredDocuments: ["As-Built Drawings", "Warranty", "Shop Drawings", "Material Certifications"],
  },
  {
    code: "07",
    name: "Thermal and Moisture Protection",
    requiredDocuments: ["Warranty", "Test Reports", "Material Certifications", "Inspection Reports"],
  },
  {
    code: "08",
    name: "Openings",
    requiredDocuments: ["As-Built Drawings", "Warranty", "Shop Drawings", "Hardware Schedule", "Keying Schedule"],
  },
  {
    code: "09",
    name: "Finishes",
    requiredDocuments: ["Warranty", "Material Certifications", "Color Schedules", "Maintenance Instructions"],
  },
  {
    code: "10",
    name: "Specialties",
    requiredDocuments: ["Warranty", "O&M Manual", "Shop Drawings"],
  },
  {
    code: "11",
    name: "Equipment",
    requiredDocuments: ["Warranty", "O&M Manual", "As-Built Drawings", "Start-Up Reports"],
  },
  {
    code: "12",
    name: "Furnishings",
    requiredDocuments: ["Warranty", "O&M Manual", "Material Certifications"],
  },
  {
    code: "13",
    name: "Special Construction",
    requiredDocuments: ["Warranty", "O&M Manual", "As-Built Drawings", "Test Reports", "Inspection Reports"],
  },
  {
    code: "14",
    name: "Conveying Equipment",
    requiredDocuments: ["Warranty", "O&M Manual", "As-Built Drawings", "Inspection Reports", "Maintenance Agreements"],
  },
  {
    code: "15",
    name: "Mechanical",
    requiredDocuments: ["Warranty", "O&M Manual", "As-Built Drawings", "Test & Balance Reports", "Start-Up Reports", "Commissioning Reports"],
  },
  {
    code: "16",
    name: "Electrical",
    requiredDocuments: ["Warranty", "O&M Manual", "As-Built Drawings", "Test Reports", "Panel Schedules", "Circuit Directories"],
  },
];

export function getCsiDivision(csiCode: string): CsiDivisionConfig | undefined {
  const divisionCode = csiCode.substring(0, 2).padStart(2, "0");
  return CSI_DIVISIONS.find((d) => d.code === divisionCode);
}
