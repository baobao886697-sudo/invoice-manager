import { eq, desc, and, like, sql, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users, priceTiers, invoices, invoiceItems, userSettings } from "../drizzle/schema";
import type { InsertUser, InsertPriceTier, PriceTier, InsertInvoice, Invoice, InsertInvoiceItem, InvoiceItem, InsertUserSettings, UserSettings } from "../drizzle/schema";
import 'dotenv/config';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ Price Tier Functions ============
export async function getPriceTiers(userId: number): Promise<PriceTier[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select().from(priceTiers)
    .where(eq(priceTiers.userId, userId))
    .orderBy(priceTiers.credits);
  return result;
}

export async function createPriceTier(tier: InsertPriceTier): Promise<PriceTier> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(priceTiers).values(tier).$returningId();
  const [newTier] = await db.select().from(priceTiers).where(eq(priceTiers.id, result.id));
  return newTier;
}

export async function updatePriceTier(id: number, userId: number, tier: Partial<InsertPriceTier>): Promise<PriceTier | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(priceTiers)
    .set(tier)
    .where(and(eq(priceTiers.id, id), eq(priceTiers.userId, userId)));
  
  const [updated] = await db.select().from(priceTiers)
    .where(and(eq(priceTiers.id, id), eq(priceTiers.userId, userId)));
  return updated || null;
}

export async function deletePriceTier(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(priceTiers)
    .where(and(eq(priceTiers.id, id), eq(priceTiers.userId, userId)));
  return true;
}

export async function bulkCreatePriceTiers(tiers: InsertPriceTier[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (tiers.length > 0) {
    // Use raw SQL to insert without id, createdAt, updatedAt fields
    // This avoids the 'default' keyword issue with Drizzle ORM
    for (const tier of tiers) {
      const sortOrder = tier.sortOrder ?? 0;
      await db.execute(sql`
        INSERT INTO price_tiers (userId, credits, minNumbers, maxNumbers, unitPrice, price, sortOrder)
        VALUES (${tier.userId}, ${tier.credits}, ${tier.minNumbers}, ${tier.maxNumbers}, ${tier.unitPrice}, ${tier.price}, ${sortOrder})
      `);
    }
  }
}

// ============ Invoice Functions ============
export async function getInvoices(userId: number, options?: {
  search?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{ invoices: Invoice[]; total: number }> {
  const db = await getDb();
  if (!db) return { invoices: [], total: 0 };
  
  const conditions = [eq(invoices.userId, userId)];
  
  if (options?.search) {
    conditions.push(like(invoices.invoiceNumber, `%${options.search}%`));
  }
  if (options?.status && options.status !== 'all') {
    conditions.push(eq(invoices.status, options.status as 'pending' | 'paid' | 'cancelled'));
  }
  if (options?.startDate) {
    conditions.push(gte(invoices.createdAt, options.startDate));
  }
  if (options?.endDate) {
    conditions.push(lte(invoices.createdAt, options.endDate));
  }
  
  const whereClause = and(...conditions);
  
  const [countResult] = await db.select({ count: sql<number>`count(*)` })
    .from(invoices)
    .where(whereClause);
  
  const result = await db.select().from(invoices)
    .where(whereClause)
    .orderBy(desc(invoices.createdAt))
    .limit(options?.limit || 20)
    .offset(options?.offset || 0);
  
  return { invoices: result, total: Number(countResult.count) };
}

export async function getInvoiceById(id: number, userId: number): Promise<Invoice | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.select().from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
  return result || null;
}

export async function getInvoiceByNumber(invoiceNumber: string, userId: number): Promise<Invoice | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.select().from(invoices)
    .where(and(eq(invoices.invoiceNumber, invoiceNumber), eq(invoices.userId, userId)));
  return result || null;
}

export async function createInvoice(invoice: InsertInvoice): Promise<Invoice> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(invoices).values(invoice).$returningId();
  const [newInvoice] = await db.select().from(invoices).where(eq(invoices.id, result.id));
  return newInvoice;
}

export async function updateInvoiceStatus(id: number, userId: number, status: 'pending' | 'paid' | 'cancelled'): Promise<Invoice | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(invoices)
    .set({ status })
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
  
  const [updated] = await db.select().from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
  return updated || null;
}

export async function deleteInvoice(id: number, userId: number): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  await db.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
  
  return { success: true };
}

// Generate a random 6-digit number
function generateRandomNumber(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function getNextInvoiceNumber(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Try up to 10 times to generate a unique invoice number
  for (let attempt = 0; attempt < 10; attempt++) {
    const randomNum = generateRandomNumber();
    const invoiceNumber = `#INV${dateStr}${randomNum}`;
    
    // Check if this invoice number already exists
    const [existing] = await db.select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(eq(invoices.invoiceNumber, invoiceNumber));
    
    if (Number(existing.count) === 0) {
      return invoiceNumber;
    }
  }
  
  // Fallback: use timestamp to ensure uniqueness
  const timestamp = Date.now().toString().slice(-6);
  return `#INV${dateStr}${timestamp}`;
}

// ============ Invoice Items Functions ============
export async function getInvoiceItems(invoiceId: number): Promise<InvoiceItem[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select().from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))
    .orderBy(invoiceItems.sortOrder);
  return result;
}

export async function createInvoiceItems(items: InsertInvoiceItem[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (items.length > 0) {
    await db.insert(invoiceItems).values(items);
  }
}

// ============ User Settings Functions ============
export async function getUserSettings(userId: number): Promise<UserSettings | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.select().from(userSettings)
    .where(eq(userSettings.userId, userId));
  return result || null;
}

export async function upsertUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(userSettings).values(settings)
    .onDuplicateKeyUpdate({
      set: {
        walletAddress: settings.walletAddress,
        companyName: settings.companyName,
      }
    });
  
  const [result] = await db.select().from(userSettings)
    .where(eq(userSettings.userId, settings.userId));
  return result;
}

// ============ Statistics Functions ============
export async function getInvoiceStats(userId: number): Promise<{
  totalAmount: number;
  totalCredits: number;
  invoiceCount: number;
  paidCount: number;
  pendingCount: number;
  monthlyStats: { month: string; amount: number; count: number }[];
}> {
  const db = await getDb();
  if (!db) return {
    totalAmount: 0,
    totalCredits: 0,
    invoiceCount: 0,
    paidCount: 0,
    pendingCount: 0,
    monthlyStats: []
  };
  
  const [stats] = await db.select({
    totalAmount: sql<number>`COALESCE(SUM(totalAmount), 0)`,
    totalCredits: sql<number>`COALESCE(SUM(totalCredits), 0)`,
    invoiceCount: sql<number>`COUNT(*)`,
    paidCount: sql<number>`SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END)`,
    pendingCount: sql<number>`SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)`,
  }).from(invoices).where(eq(invoices.userId, userId));
  
  const monthlyStats = await db.select({
    month: sql<string>`DATE_FORMAT(createdAt, '%Y-%m')`,
    amount: sql<number>`COALESCE(SUM(totalAmount), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(invoices)
    .where(and(
      eq(invoices.userId, userId),
      gte(invoices.createdAt, sql`DATE_SUB(NOW(), INTERVAL 6 MONTH)`)
    ))
    .groupBy(sql`DATE_FORMAT(createdAt, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(createdAt, '%Y-%m')`);
  
  return {
    totalAmount: Number(stats.totalAmount) || 0,
    totalCredits: Number(stats.totalCredits) || 0,
    invoiceCount: Number(stats.invoiceCount) || 0,
    paidCount: Number(stats.paidCount) || 0,
    pendingCount: Number(stats.pendingCount) || 0,
    monthlyStats: monthlyStats.map(m => ({
      month: m.month,
      amount: Number(m.amount) || 0,
      count: Number(m.count) || 0
    }))
  };
}
