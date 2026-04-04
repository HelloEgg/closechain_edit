import { Router } from "express";
import archiver from "archiver";
import XLSX from "xlsx-js-style";
import { db, projectsTable, subcontractorsTable, documentSlotsTable } from "@workspace/db";
import { eq, ne, and, asc } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";
import { getCsiDivision } from "../lib/csiDivisions";
import {
  type ActiveSection,
  loadKnownCsiDocTypes,
  buildActiveSections,
  canonicalFolderName,
  sortDocTypes,
} from "../lib/downloadSections";

const router = Router();
const storageService = new ObjectStorageService();

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

const NAVY = "1F3864";
const STEEL = "4472C4";
const LIGHT_BLUE = "D6E4F0";
const LIGHT_GRAY = "F2F2F2";
const MED_GRAY = "BFBFBF";
const DARK_CHAR = "333333";

const solidFill = (rgb: string) => ({ patternType: "solid" as const, fgColor: { rgb } });

const borderThin = (rgb: string) => ({ style: "thin", color: { rgb } });
const borderMed = (rgb: string) => ({ style: "medium", color: { rgb } });
const allBorders = (rgb: string) => ({
  top: borderThin(rgb),
  bottom: borderThin(rgb),
  left: borderThin(rgb),
  right: borderThin(rgb),
});
const bottomOnly = (rgb: string, style = "thin") => ({
  bottom: { style, color: { rgb } },
});

type WS = XLSX.WorkSheet;

function cellRef(r: number, c: number): string {
  const col = String.fromCharCode(65 + c);
  return `${col}${r + 1}`;
}

function ensureCell(ws: WS, ref: string, style: Record<string, any>) {
  if (!ws[ref]) ws[ref] = { v: "", t: "s" };
  ws[ref].s = { ...(ws[ref].s || {}), ...style };
}

function applyStyle(ws: WS, ref: string, style: Record<string, any>) {
  if (!ws[ref]) return;
  ws[ref].s = { ...(ws[ref].s || {}), ...style };
}

function setCell(ws: WS, r: number, c: number, value: string, style: Record<string, any>) {
  const ref = cellRef(r, c);
  ws[ref] = { v: value, t: "s", s: style };
}

function fillRowCols(ws: WS, r: number, startCol: number, endCol: number, style: Record<string, any>) {
  for (let c = startCol; c <= endCol; c++) {
    ensureCell(ws, cellRef(r, c), style);
  }
}

async function buildTrackingLog(
  projectName: string,
  projectNumber: string | null,
  endDate: string | null,
  hierarchy: Record<string, DocTypeGroup>,
  activeSections: ActiveSection[],
): Promise<Buffer> {
  const wb = XLSX.utils.book_new();
  const ws: WS = {};

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

  const FONT = "Calibri";
  const navyRowStyle = { fill: solidFill(NAVY), font: { name: FONT, bold: true, color: { rgb: "FFFFFF" }, sz: 11 } };
  const navyLabelStyle = { ...navyRowStyle };
  const navyValueStyle = { fill: solidFill(NAVY), font: { name: FONT, color: { rgb: "FFFFFF" }, sz: 11 } };

  setCell(ws, 0, 0, "Project Name:", navyLabelStyle);
  setCell(ws, 0, 2, projectName, navyValueStyle);
  fillRowCols(ws, 0, 1, 5, { fill: solidFill(NAVY) });

  setCell(ws, 1, 0, "Project Number:", navyLabelStyle);
  setCell(ws, 1, 2, projectNumber || "", navyValueStyle);
  fillRowCols(ws, 1, 1, 5, { fill: solidFill(NAVY) });

  setCell(ws, 2, 0, "End Date:", navyLabelStyle);
  setCell(ws, 2, 2, endDate || "", navyValueStyle);
  fillRowCols(ws, 2, 1, 5, { fill: solidFill(NAVY) });

  setCell(ws, 5, 2, "Close Out Index/Tracking Log", {
    fill: solidFill(NAVY),
    font: { name: FONT, bold: true, color: { rgb: "FFFFFF" }, sz: 16 },
    alignment: { horizontal: "center" },
  });
  fillRowCols(ws, 5, 0, 5, { fill: solidFill(NAVY) });

  setCell(ws, 7, 2, "Index", {
    fill: solidFill(LIGHT_GRAY),
    font: { name: FONT, bold: true, color: { rgb: DARK_CHAR }, sz: 12 },
  });
  fillRowCols(ws, 7, 0, 5, { fill: solidFill(LIGHT_GRAY) });

  setCell(ws, 7, 7, "Color Key", {
    fill: solidFill(DARK_CHAR),
    font: { name: FONT, bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
    alignment: { horizontal: "center" },
    border: allBorders(MED_GRAY),
  });

  setCell(ws, 8, 7, "Black: Closed (Received)", {
    fill: solidFill("E8E8E8"),
    font: { name: FONT, bold: true, color: { rgb: "000000" }, sz: 11 },
    border: allBorders(MED_GRAY),
  });

  setCell(ws, 9, 7, "Red: Open", {
    fill: solidFill("FFE5E5"),
    font: { name: FONT, bold: true, color: { rgb: "CC0000" }, sz: 11 },
    border: allBorders(MED_GRAY),
  });

  setCell(ws, 10, 7, "Blue - Owed by Structuretone", {
    fill: solidFill("E5E5FF"),
    font: { name: FONT, bold: true, color: { rgb: "0000CC" }, sz: 11 },
    border: allBorders(MED_GRAY),
  });

  const dirSectionStyle = {
    fill: solidFill(LIGHT_BLUE),
    font: { name: FONT, bold: true, color: { rgb: DARK_CHAR }, sz: 11 },
    border: bottomOnly(STEEL),
  };
  setCell(ws, 9, 2, "01-Directory", dirSectionStyle);
  fillRowCols(ws, 9, 0, 5, { fill: solidFill(LIGHT_BLUE), border: bottomOnly(STEEL) });
  applyStyle(ws, cellRef(9, 2), dirSectionStyle);

  let currentRow = 11;

  const rowHeights: Record<number, number> = {
    0: 22, 1: 22, 2: 22,
    5: 30,
    7: 22,
    9: 22,
  };

  for (const section of activeSections) {
    const folderLabel = canonicalFolderName(section);
    const sectionHeaderStyle = {
      fill: solidFill(LIGHT_BLUE),
      font: { name: FONT, bold: true, color: { rgb: DARK_CHAR }, sz: 11 },
      border: bottomOnly(STEEL, "medium"),
    };

    setCell(ws, currentRow, 2, folderLabel, sectionHeaderStyle);
    fillRowCols(ws, currentRow, 0, 5, { fill: solidFill(LIGHT_BLUE), border: bottomOnly(STEEL, "medium") });
    applyStyle(ws, cellRef(currentRow, 2), sectionHeaderStyle);
    rowHeights[currentRow] = 22;

    const sectionHeaderRow = currentRow;
    currentRow++;

    const docType = section.docType;
    if (docType && hierarchy[docType]) {
      const group = hierarchy[docType];
      const allVendors: VendorEntry[] = [...group.directVendors];
      for (const subType of Object.keys(group.subTypes).sort()) {
        allVendors.push(...group.subTypes[subType].vendors);
      }

      const isTestingSection = docType === "Testing/Demonstration";

      if (isTestingSection) {
        const displayEntries: { label: string; status: string }[] = [];
        for (const v of allVendors) {
          const subDocLabel = v.subDocType || docType;
          const label = `"${subDocLabel}" ${v.vendorName}`;
          if (!displayEntries.some((e) => e.label === label)) {
            displayEntries.push({ label, status: v.status });
          }
        }

        for (const entry of displayEntries) {
          let fontColor = "FF0000";
          if (entry.status === "approved") fontColor = "000000";
          setCell(ws, currentRow, 2, entry.label, {
            font: { name: FONT, color: { rgb: fontColor }, sz: 11 },
            alignment: { indent: 1 },
            border: { left: borderMed(STEEL) },
          });
          currentRow++;
        }
      } else {
        const uniqueVendors = new Map<string, VendorEntry>();
        for (const v of allVendors) {
          const dedupeKey = `${v.vendorName}::${v.csiCode}`;
          if (!uniqueVendors.has(dedupeKey)) {
            uniqueVendors.set(dedupeKey, v);
          }
        }

        for (const [, vendor] of uniqueVendors) {
          let fontColor = "FF0000";
          if (vendor.status === "approved") fontColor = "000000";
          const vendorType = vendorTypeCache.get(vendor.csiCode) ?? vendor.csiCode;
          setCell(ws, currentRow, 2, `(${vendorType}) ${vendor.vendorName}`, {
            font: { name: FONT, color: { rgb: fontColor }, sz: 11 },
            alignment: { indent: 1 },
            border: { left: borderMed(STEEL) },
          });
          currentRow++;
        }
      }
    }

    currentRow++;
  }

  const endRow = currentRow;
  setCell(ws, endRow, 2, "End", {
    fill: solidFill(NAVY),
    font: { name: FONT, bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
  });
  fillRowCols(ws, endRow, 0, 5, { fill: solidFill(NAVY) });
  applyStyle(ws, cellRef(endRow, 2), {
    fill: solidFill(NAVY),
    font: { name: FONT, bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
  });
  rowHeights[endRow] = 22;

  const totalRows = endRow + 1;
  const totalCols = 11;
  ws["!ref"] = `A1:${String.fromCharCode(65 + totalCols - 1)}${totalRows}`;

  ws["!cols"] = [
    { wch: 16 }, { wch: 6 }, { wch: 40 }, { wch: 52 },
    { wch: 12 }, { wch: 12 }, { wch: 3 }, { wch: 32 },
    { wch: 8 }, { wch: 8 }, { wch: 8 },
  ];

  ws["!rows"] = [];
  for (let r = 0; r < totalRows; r++) {
    ws["!rows"][r] = rowHeights[r] ? { hpt: rowHeights[r] } : {};
  }

  (ws as any)["!views"] = [{ state: "frozen", ySplit: 3 }];

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
      .where(
        and(
          eq(subcontractorsTable.projectId, projectId),
          ne(subcontractorsTable.vendorName, "__PROJECT_LEVEL__"),
          ne(subcontractorsTable.csiCode, "000000"),
        ),
      )
      .orderBy(asc(subcontractorsTable.csiCode), asc(documentSlotsTable.documentType));

    const hierarchy = buildHierarchy(rows);

    const knownCsiDocTypes = await loadKnownCsiDocTypes();
    const docTypeKeys = Object.keys(hierarchy);
    const sortedDt = sortDocTypes(docTypeKeys, knownCsiDocTypes);
    const projectLevelDocTypes = new Set<string>();
    const activeSections = buildActiveSections(sortedDt, projectLevelDocTypes, knownCsiDocTypes);

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
      hierarchy,
      activeSections,
    );
    archive.append(xlsxBuffer, { name: `${projectFolder}/00-Index/Tracking Log.xlsx` });

    archive.append(Buffer.alloc(0), { name: `${projectFolder}/01-Directory/` });

    for (const section of activeSections) {
      const sectionFolder = sanitize(canonicalFolderName(section));
      const docType = section.docType;

      archive.append(Buffer.alloc(0), { name: `${projectFolder}/${sectionFolder}/` });

      if (!docType || !hierarchy[docType]) {
        continue;
      }

      const group = hierarchy[docType];

      for (const vendor of group.directVendors) {
        const safeVendor = sanitize(vendor.vendorName);
        const folderPath = `${projectFolder}/${sectionFolder}/${safeVendor}`;

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
          const safeVendor = sanitize(vendor.vendorName);
          const folderPath = `${projectFolder}/${sectionFolder}/${safeSubType}/${safeVendor}`;

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
