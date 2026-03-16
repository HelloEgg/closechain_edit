import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";
import { documentSlotsTable } from "./documentSlots";

export const uploadedFilesTable = pgTable("uploaded_files", {
  id: serial("id").primaryKey(),
  documentSlotId: integer("document_slot_id")
    .notNull()
    .references(() => documentSlotsTable.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  filePath: varchar("file_path", { length: 1000 }).notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 255 }),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});
