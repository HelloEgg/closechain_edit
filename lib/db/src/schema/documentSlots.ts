import { pgTable, serial, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { subcontractorsTable } from "./subcontractors";

export const documentSlotsTable = pgTable("document_slots", {
  id: serial("id").primaryKey(),
  subcontractorId: integer("subcontractor_id").notNull().references(() => subcontractorsTable.id, { onDelete: "cascade" }),
  documentType: varchar("document_type", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("not_submitted"),
  filePath: varchar("file_path", { length: 500 }),
  fileName: varchar("file_name", { length: 255 }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDocumentSlotSchema = createInsertSchema(documentSlotsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocumentSlot = z.infer<typeof insertDocumentSlotSchema>;
export type DocumentSlot = typeof documentSlotsTable.$inferSelect;
