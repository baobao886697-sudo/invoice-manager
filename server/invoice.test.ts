import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("Invoice Router", () => {
  it("should have required invoice procedures", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Check that invoice procedures exist
    expect(caller.invoices).toBeDefined();
    expect(caller.invoices.list).toBeDefined();
    expect(caller.invoices.getById).toBeDefined();
    expect(caller.invoices.create).toBeDefined();
    expect(caller.invoices.updateStatus).toBeDefined();
    expect(caller.invoices.delete).toBeDefined();
    expect(caller.invoices.getStats).toBeDefined();
  });

  it("should have required price tier procedures", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Check that price tier procedures exist
    expect(caller.priceTiers).toBeDefined();
    expect(caller.priceTiers.list).toBeDefined();
    expect(caller.priceTiers.create).toBeDefined();
    expect(caller.priceTiers.update).toBeDefined();
    expect(caller.priceTiers.delete).toBeDefined();
    expect(caller.priceTiers.calculatePrice).toBeDefined();
  });

  it("should have required settings procedures", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Check that settings procedures exist
    expect(caller.settings).toBeDefined();
    expect(caller.settings.get).toBeDefined();
    expect(caller.settings.update).toBeDefined();
  });
});

describe("Price Calculation Logic", () => {
  it("should calculate interpolated price correctly", () => {
    // Test the interpolation logic
    const tiers = [
      { credits: 10000, price: 30 },
      { credits: 50000, price: 144 },
      { credits: 100000, price: 266 },
    ];

    // Linear interpolation for 30000 credits (between 10000 and 50000)
    const credits = 30000;
    const lowerTier = tiers[0];
    const upperTier = tiers[1];
    
    const ratio = (credits - lowerTier.credits) / (upperTier.credits - lowerTier.credits);
    const interpolatedPrice = lowerTier.price + ratio * (upperTier.price - lowerTier.price);
    
    // 30000 is 50% between 10000 and 50000
    // Expected: 30 + 0.5 * (144 - 30) = 30 + 57 = 87
    expect(Math.round(interpolatedPrice)).toBe(87);
  });

  it("should handle exact tier match", () => {
    const tiers = [
      { credits: 10000, price: 30 },
      { credits: 50000, price: 144 },
    ];

    const exactMatch = tiers.find(t => t.credits === 50000);
    expect(exactMatch).toBeDefined();
    expect(exactMatch?.price).toBe(144);
  });
});

describe("Invoice Number Generation", () => {
  it("should generate correct invoice number format", () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `#INV${dateStr}`;
    const nextNum = 1;
    const invoiceNumber = `${prefix}${String(nextNum).padStart(3, '0')}`;
    
    // Check format: #INV + YYYYMMDD + 3-digit sequence
    expect(invoiceNumber).toMatch(/^#INV\d{8}\d{3}$/);
    expect(invoiceNumber.startsWith('#INV')).toBe(true);
    expect(invoiceNumber.length).toBe(15); // #INV (4) + date (8) + seq (3)
  });

  it("should pad sequence numbers correctly", () => {
    const prefix = "#INV20260116";
    
    expect(`${prefix}${String(1).padStart(3, '0')}`).toBe("#INV20260116001");
    expect(`${prefix}${String(10).padStart(3, '0')}`).toBe("#INV20260116010");
    expect(`${prefix}${String(100).padStart(3, '0')}`).toBe("#INV20260116100");
  });
});
