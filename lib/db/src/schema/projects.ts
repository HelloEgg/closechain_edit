import { pgTable, serial, text, varchar, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  jobNumber: varchar("job_number", { length: 100 }),
  description: text("description"),
  clientName: varchar("client_name", { length: 255 }).notNull(),
  address: text("address"),
  endDate: varchar("end_date", { length: 20 }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  clientPortalToken: varchar("client_portal_token", { length: 255 }).unique(),
  userId: varchar("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
