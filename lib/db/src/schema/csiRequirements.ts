import { pgTable, serial, varchar } from "drizzle-orm/pg-core";

export const csiDocumentRequirementsTable = pgTable("csi_document_requirements", {
  id: serial("id").primaryKey(),
  csiCode: varchar("csi_code", { length: 10 }).notNull(),
  divisionName: varchar("division_name", { length: 255 }).notNull(),
  documentType: varchar("document_type", { length: 255 }).notNull(),
  parentDocumentType: varchar("parent_document_type", { length: 255 }),
});
