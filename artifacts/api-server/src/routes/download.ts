import { Router } from "express";
import archiver from "archiver";
import XLSX from "xlsx-js-style";
import { db, projectsTable, subcontractorsTable, documentSlotsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";
import { getCsiDivision } from "../lib/csiDivisions";

const router = Router();
const storageService = new ObjectStorageService();

const DOC_TYPE_ORDER = [
  "Permit",
  "Inspection/Sign Offs",
  "As-Built",
  "Balancing Report",
  "Testing/Demonstration",
  "Equipment O&M",
  "Submittal",
  "Warranty",
  "Architectural Maintenance Instruction",
];

function docTypeSortKey(docType: string): number {
  const idx = DOC_TYPE_ORDER.indexOf(docType);
  return idx === -1 ? DOC_TYPE_ORDER.length : idx;
}

function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*]+/g, "_").replace(/\.+$/, "").trim() || "Untitled";
}

interface DocRow {
  slotId: number;
  documentType: string;
  parentDocumentType: string | null;
  status: string;
  filePath: string | null;
  fileName: string | null;
  vendorName: string;
  csiCode: string;
}

interface VendorEntry {
  vendorName: string;
  csiCode: string;
  status: string;
  filePath: string | null;
  fileName: string | null;
  subDocType?: string;
}

interface SubTypeGroup {
  vendors: VendorEntry[];
}

interface DocTypeGroup {
  subTypes: Record<string, SubTypeGroup>;
  directVendors: VendorEntry[];
}

function buildHierarchy(rows: DocRow[]): Record<string, DocTypeGroup> {
  const groups: Record<string, DocTypeGroup> = {};

  for (const row of rows) {
    const parentKey = row.parentDocumentType || row.documentType;
    const isSubItem = !!row.parentDocumentType;

    if (!groups[parentKey]) {
      groups[parentKey] = { subTypes: {}, directVendors: [] };
    }

    const vendor: VendorEntry = {
      vendorName: row.vendorName,
      csiCode: row.csiCode,
      status: row.status,
      filePath: row.filePath,
      fileName: row.fileName,
      subDocType: isSubItem ? row.documentType : undefined,
    };

    if (isSubItem) {
      if (!groups[parentKey].subTypes[row.documentType]) {
        groups[parentKey].subTypes[row.documentType] = { vendors: [] };
      }
      groups[parentKey].subTypes[row.documentType].vendors.push(vendor);
    } else {
      groups[parentKey].directVendors.push(vendor);
    }
  }

  return groups;
}

async function buildTrackingLog(
  projectName: string,
  projectNumber: string | null,
  endDate: string | null,
  hierarchy: Record<string, DocTypeGroup>
): Promise<Buffer> {
  const wb = XLSX.utils.book_new();
  const rows: any[][] = [];

  const headerFill = { fgColor: { rgb: "002060" } };
  const headerFont = { bold: true, color: { rgb: "FFFFFF" }, sz: 14 };
  const subHeaderFont = { bold: true, sz: 12 };
  const normalFont = { sz: 11 };
  const redFont = { sz: 11, color: { rgb: "FF0000" } };
  const blueFont = { sz: 11, color: { rgb: "0000FF" } };
  const blackFont = { sz: 11, color: { rgb: "000000" } };

  rows.push([
    { v: `Project: ${projectName}`, s: { font: { bold: true, sz: 14 } } },
    "",
    "",
    projectNumber ? { v: `Job #: ${projectNumber}`, s: { font: { bold: true, sz: 12 } } } : "",
    "",
    endDate ? { v: `End Date: ${endDate}`, s: { font: { bold: true, sz: 12 } } } : "",
  ]);

  rows.push([
    { v: "Close Out Index / Tracking Log", s: { font: headerFont, fill: headerFill, alignment: { horizontal: "center" } } },
  ]);
  rows.push([]);

  rows.push([
    { v: "Color Key:", s: { font: { bold: true, sz: 11 } } },
  ]);
  rows.push([
    { v: "Black = Closed / Received", s: { font: blackFont } },
  ]);
  rows.push([
    { v: "Red = Open", s: { font: redFont } },
  ]);
  rows.push([
    { v: "Blue = Owed by Structuretone", s: { font: blueFont } },
  ]);
  rows.push([]);

  const sortedDocTypes = Object.keys(hierarchy).sort(
    (a, b) => docTypeSortKey(a) - docTypeSortKey(b)
  );

  const allCsiCodes = new Set<string>();
  for (const group of Object.values(hierarchy)) {
    for (const v of group.directVendors) allCsiCodes.add(v.csiCode);
    for (const st of Object.values(group.subTypes)) {
      for (const v of st.vendors) allCsiCodes.add(v.csiCode);
    }
  }
  const vendorTypeCache = new Map<string, string>();
  for (const code of allCsiCodes) {
    const division = await getCsiDivision(code);
    vendorTypeCache.set(code, division ? division.name : code);
  }

  let sectionNum = 1;
  for (const docType of sortedDocTypes) {
    const group = hierarchy[docType];

    rows.push([
      {
        v: `${sectionNum}. ${docType}`,
        s: { font: subHeaderFont, fill: { fgColor: { rgb: "D9E2F3" } } },
      },
    ]);

    const allVendors: VendorEntry[] = [...group.directVendors];
    for (const subType of Object.keys(group.subTypes).sort()) {
      allVendors.push(...group.subTypes[subType].vendors);
    }

    const isTestingSection = docType === "Testing/Demonstration";

    if (isTestingSection) {
      const displayEntries: { label: string; status: string }[] = [];
      for (const v of allVendors) {
        if (v.vendorName === "__PROJECT_LEVEL__") continue;
        const subDocLabel = v.subDocType || docType;
        const label = `"${subDocLabel}" ${v.vendorName}`;
        if (!displayEntries.some((e) => e.label === label)) {
          displayEntries.push({ label, status: v.status });
        }
      }

      if (displayEntries.length === 0) {
        rows.push([{ v: "  (Project Level)", s: { font: normalFont } }]);
      } else {
        for (const entry of displayEntries) {
          let font = redFont;
          if (entry.status === "approved") font = blackFont;
          rows.push([{ v: `  ${entry.label}`, s: { font } }]);
        }
      }
    } else {
      const uniqueVendors = new Map<string, VendorEntry>();
      for (const v of allVendors) {
        const dedupeKey = `${v.vendorName}::${v.csiCode}`;
        if (v.vendorName !== "__PROJECT_LEVEL__" && !uniqueVendors.has(dedupeKey)) {
          uniqueVendors.set(dedupeKey, v);
        }
      }

      if (uniqueVendors.size === 0) {
        rows.push([{ v: "  (Project Level)", s: { font: normalFont } }]);
      } else {
        for (const [, vendor] of uniqueVendors) {
          let font = redFont;
          if (vendor.status === "approved") font = blackFont;
          const vendorType = vendorTypeCache.get(vendor.csiCode) ?? vendor.csiCode;
          rows.push([{ v: `  (${vendorType}) ${vendor.vendorName}`, s: { font } }]);
        }
      }
    }

    rows.push([]);
    sectionNum++;
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(wb, ws, "Tracking Log");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}

router.get("/projects/:projectId/download", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user!.id)))
      .limit(1);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const rows = await db
      .select({
        slotId: documentSlotsTable.id,
        documentType: documentSlotsTable.documentType,
        parentDocumentType: documentSlotsTable.parentDocumentType,
        status: documentSlotsTable.status,
        filePath: documentSlotsTable.filePath,
        fileName: documentSlotsTable.fileName,
        vendorName: subcontractorsTable.vendorName,
        csiCode: subcontractorsTable.csiCode,
      })
      .from(documentSlotsTable)
      .innerJoin(
        subcontractorsTable,
        eq(documentSlotsTable.subcontractorId, subcontractorsTable.id)
      )
      .where(eq(subcontractorsTable.projectId, projectId))
      .orderBy(asc(subcontractorsTable.csiCode), asc(documentSlotsTable.documentType));

    const hierarchy = buildHierarchy(rows);

    const projectFolder = sanitize(project.name);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${projectFolder}.zip"`
    );

    const archive = archiver("zip", { zlib: { level: 5 } });
    archive.on("error", (err) => {
      console.error("Archive error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to create archive" });
      }
    });
    archive.pipe(res);

    const xlsxBuffer = await buildTrackingLog(
      project.name,
      project.jobNumber,
      project.endDate,
      hierarchy
    );
    archive.append(xlsxBuffer, { name: `${projectFolder}/Tracking Log.xlsx` });

    const sortedDocTypes = Object.keys(hierarchy).sort(
      (a, b) => docTypeSortKey(a) - docTypeSortKey(b)
    );

    for (const docType of sortedDocTypes) {
      const group = hierarchy[docType];
      const safeDocType = sanitize(docType);

      for (const vendor of group.directVendors) {
        const safeVendor = sanitize(
          vendor.vendorName === "__PROJECT_LEVEL__"
            ? "Project Level"
            : vendor.vendorName
        );
        const folderPath = `${projectFolder}/${safeDocType}/${safeVendor}`;

        if (vendor.filePath) {
          try {
            const result = await storageService.downloadObjectDirect(vendor.filePath);
            if (result) {
              const ext = vendor.fileName
                ? vendor.fileName.substring(vendor.fileName.lastIndexOf("."))
                : "";
              const safeName = vendor.fileName
                ? sanitize(vendor.fileName)
                : `${safeVendor}${ext}`;
              archive.append(result.data, { name: `${folderPath}/${safeName}` });
            } else {
              archive.append(Buffer.alloc(0), { name: `${folderPath}/` });
            }
          } catch {
            archive.append(Buffer.alloc(0), { name: `${folderPath}/` });
          }
        } else {
          archive.append(Buffer.alloc(0), { name: `${folderPath}/` });
        }
      }

      for (const [subType, subGroup] of Object.entries(group.subTypes).sort(
        (a, b) => a[0].localeCompare(b[0])
      )) {
        const safeSubType = sanitize(subType);

        for (const vendor of subGroup.vendors) {
          const safeVendor = sanitize(
            vendor.vendorName === "__PROJECT_LEVEL__"
              ? "Project Level"
              : vendor.vendorName
          );
          const folderPath = `${projectFolder}/${safeDocType}/${safeSubType}/${safeVendor}`;

          if (vendor.filePath) {
            try {
              const result = await storageService.downloadObjectDirect(vendor.filePath);
              if (result) {
                const safeName = vendor.fileName
                  ? sanitize(vendor.fileName)
                  : `${safeVendor}`;
                archive.append(result.data, { name: `${folderPath}/${safeName}` });
              } else {
                archive.append(Buffer.alloc(0), { name: `${folderPath}/` });
              }
            } catch {
              archive.append(Buffer.alloc(0), { name: `${folderPath}/` });
            }
          } else {
            archive.append(Buffer.alloc(0), { name: `${folderPath}/` });
          }
        }
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error("Download error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate download" });
    }
  }
});

export default router;
