import { db } from "@workspace/db";
import { csiDocumentRequirementsTable } from "@workspace/db";

const TRADES: { code: string; name: string; docs: string[] }[] = [
  { code: "270000", name: "Audio Visual", docs: ["As-Built", "Testing/Demonstration", "AV Demonstration", "Equipment O&M", "Warranty"] },
  { code: "102219", name: "Demountable Partitions", docs: ["As-Built", "Warranty", "Architectural Maintenance Instructions"] },
  { code: "102200", name: "Bathroom Partitions", docs: ["As-Built", "Warranty", "Architectural Maintenance Instructions"] },
  { code: "102226", name: "Operable Partitions", docs: ["As-Built", "Equipment O&M", "Testing/Demonstration", "Folding Partition Demonstration", "Warranty"] },
  { code: "096800", name: "Carpet", docs: ["Architectural Maintenance Instructions", "Warranty", "Manufacturer Warranty", "Subcontractor Installation Warranty"] },
  { code: "260000", name: "Electric", docs: ["As-Built", "Testing/Demonstration", "PDU Start Up & Factory Reports", "UPS Start Up & Factory Reports", "Switch Gear Start Up Report", "Equipment O&M", "Warranty"] },
  { code: "283100", name: "Fire Alarm", docs: ["As-Built", "Warranty"] },
  { code: "098000", name: "Fabric Panel / Acoustical Wrap Panels", docs: ["As-Built", "Warranty", "Architectural Maintenance Instructions"] },
  { code: "210000", name: "Fire Protection (Sprinkler)", docs: ["Testing/Demonstration", "Fire Protection Hydro Test Report", "Pre Action Test Report", "Equipment O&M", "Pre Action O&Ms", "As-Built", "Warranty"] },
  { code: "114000", name: "Food Service Equipment", docs: ["As-Built", "Warranty", "Testing/Demonstration", "Equipment O&M", "ANSUL Test"] },
  { code: "052100", name: "Steel", docs: ["As-Built", "Warranty"] },
  { code: "230000", name: "HVAC", docs: ["As-Built", "Testing/Demonstration", "HVAC Equipment Start Up Reports", "HVAC Piping Pressure Test Reports", "Chemical Cleaning Report", "Equipment O&M", "Warranty", "Balancing Report"] },
  { code: "230900", name: "HVAC Controls", docs: ["Equipment O&M", "Warranty", "Testing/Demonstration", "Controls Demonstration"] },
  { code: "088000", name: "Metal & Glass", docs: ["As-Built", "Warranty", "Architectural Maintenance Instructions"] },
  { code: "064000", name: "Millwork", docs: ["As-Built", "Warranty", "Architectural Maintenance Instructions"] },
  { code: "101100", name: "Office Fronts", docs: ["As-Built", "Warranty", "Architectural Maintenance Instructions"] },
  { code: "220000", name: "Plumbing", docs: ["As-Built", "Equipment O&M", "Warranty", "Testing/Demonstration", "Gas Pressure Test Report"] },
  { code: "096900", name: "Raised Computer Floor", docs: ["As-Built", "Equipment O&M", "Warranty"] },
  { code: "096000", name: "Flooring", docs: ["Warranty", "Architectural Maintenance Instructions"] },
  { code: "281000", name: "Security", docs: ["As-Built", "Equipment O&M", "Testing/Demonstration", "Security Demonstration", "Warranty"] },
  { code: "274000", name: "Telecommunications", docs: ["As-Built", "Warranty", "Testing/Demonstration", "Data Test Report"] },
  { code: "093000", name: "Tile & Stone", docs: ["As-Built", "Warranty", "Architectural Maintenance Instructions"] },
  { code: "122000", name: "Window Treatment", docs: ["As-Built", "Warranty", "Architectural Maintenance Instructions", "Equipment O&M"] },
  { code: "265000", name: "Lighting Fixtures", docs: ["Testing/Demonstration", "Lighting Demonstrations", "Equipment O&M", "Warranty"] },
  { code: "099000", name: "Paint", docs: ["Warranty", "Architectural Maintenance Instructions"] },
  { code: "097200", name: "Wallcovering", docs: ["Warranty", "Architectural Maintenance Instructions"] },
  { code: "250500", name: "Sound Masking / Acoustics", docs: ["Architectural Maintenance Instructions", "As-Built", "Equipment O&M", "Testing/Demonstration", "Acoustical Test"] },
  { code: "092900", name: "Ceiling", docs: ["As-Built", "Warranty", "Architectural Maintenance Instructions"] },
  { code: "061000", name: "Carpentry", docs: ["As-Built", "Equipment O&M", "Warranty"] },
  { code: "102100", name: "Toilet Partitions", docs: ["As-Built", "Architectural Maintenance Instructions", "Warranty"] },
  { code: "033000", name: "Concrete", docs: ["Warranty", "As-Built"] },
  { code: "072200", name: "Roofing / Waterproofing", docs: ["Warranty"] },
];

async function main() {
  await db.delete(csiDocumentRequirementsTable);
  console.log("Cleared old CSI data");

  const rows: { csiCode: string; divisionName: string; documentType: string }[] = [];
  for (const trade of TRADES) {
    for (const doc of trade.docs) {
      rows.push({ csiCode: trade.code, divisionName: trade.name, documentType: doc });
    }
  }

  await db.insert(csiDocumentRequirementsTable).values(rows);
  console.log(`Seeded ${rows.length} rows across ${TRADES.length} trades`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
