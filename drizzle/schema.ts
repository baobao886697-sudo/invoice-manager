import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Price tiers table - stores the pricing structure for credits
 */
export const priceTiers = mysqlTable("price_tiers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  credits: int("credits").notNull(), // 积分数量
  minNumbers: int("minNumbers").notNull(), // 可获取号码数量下限
  maxNumbers: int("maxNumbers").notNull(), // 可获取号码数量上限
  unitPrice: decimal("unitPrice", { precision: 10, scale: 6 }).notNull(), // 单价
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // 价格(USD)
  sortOrder: int("sortOrder").default(0).notNull(), // 排序顺序
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PriceTier = typeof priceTiers.$inferSelect;
export type InsertPriceTier = typeof priceTiers.$inferInsert;

/**
 * Invoices table - stores generated invoices
 */
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  invoiceNumber: varchar("invoiceNumber", { length: 32 }).notNull().unique(), // 订单编号 #INV+日期+序号
  customerNote: text("customerNote"), // 客户备注
  totalCredits: int("totalCredits").notNull(), // 总积分
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(), // 总金额
  walletAddress: varchar("walletAddress", { length: 64 }).notNull(), // 收款地址
  status: mysqlEnum("status", ["pending", "paid", "cancelled"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

/**
 * Invoice items table - stores individual items in an invoice
 */
export const invoiceItems = mysqlTable("invoice_items", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  credits: int("credits").notNull(), // 积分数量
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // 价格
  sortOrder: int("sortOrder").default(0).notNull(), // 排序顺序
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = typeof invoiceItems.$inferInsert;

/**
 * User settings table - stores user-specific settings like wallet address
 */
export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  walletAddress: varchar("walletAddress", { length: 64 }).default("").notNull(), // USDT-TRC20收款地址
  companyName: varchar("companyName", { length: 128 }).default("云端寻踪搜索助手").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;
