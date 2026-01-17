import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import * as db from "./db";

// Context type
type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

type TrpcContext = {
  req: any;
  res: any;
  user: User | null;
};

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "请先登录" });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(() => {
      return { success: true } as const;
    }),
  }),

  // Price Tiers Router
  priceTiers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getPriceTiers(ctx.user.id);
    }),
    
    create: protectedProcedure
      .input(z.object({
        credits: z.number().int().positive(),
        minNumbers: z.number().int().nonnegative(),
        maxNumbers: z.number().int().nonnegative(),
        unitPrice: z.string(),
        price: z.string(),
        sortOrder: z.number().int().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createPriceTier({
          userId: ctx.user.id,
          credits: input.credits,
          minNumbers: input.minNumbers,
          maxNumbers: input.maxNumbers,
          unitPrice: input.unitPrice,
          price: input.price,
          sortOrder: input.sortOrder || 0,
        });
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        credits: z.number().int().positive().optional(),
        minNumbers: z.number().int().nonnegative().optional(),
        maxNumbers: z.number().int().nonnegative().optional(),
        unitPrice: z.string().optional(),
        price: z.string().optional(),
        sortOrder: z.number().int().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return db.updatePriceTier(id, ctx.user.id, data);
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        return db.deletePriceTier(input.id, ctx.user.id);
      }),
    
    bulkCreate: protectedProcedure
      .input(z.array(z.object({
        credits: z.number().int().positive(),
        minNumbers: z.number().int().nonnegative(),
        maxNumbers: z.number().int().nonnegative(),
        unitPrice: z.string(),
        price: z.string(),
        sortOrder: z.number().int().optional(),
      })))
      .mutation(async ({ ctx, input }) => {
        const tiers = input.map((tier, index) => ({
          userId: ctx.user.id,
          credits: tier.credits,
          minNumbers: tier.minNumbers,
          maxNumbers: tier.maxNumbers,
          unitPrice: tier.unitPrice,
          price: tier.price,
          sortOrder: tier.sortOrder ?? index,
        }));
        await db.bulkCreatePriceTiers(tiers);
        return { success: true };
      }),
    
    // Calculate price based on credits using interpolation
    calculatePrice: protectedProcedure
      .input(z.object({ credits: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const tiers = await db.getPriceTiers(ctx.user.id);
        if (tiers.length === 0) return null;
        
        // Sort by credits
        const sortedTiers = [...tiers].sort((a, b) => a.credits - b.credits);
        
        // Find exact match
        const exactMatch = sortedTiers.find(t => t.credits === input.credits);
        if (exactMatch) {
          return {
            price: Number(exactMatch.price),
            unitPrice: Number(exactMatch.unitPrice),
            isExact: true,
          };
        }
        
        // Find surrounding tiers for interpolation
        let lowerTier = sortedTiers[0];
        let upperTier = sortedTiers[sortedTiers.length - 1];
        
        for (let i = 0; i < sortedTiers.length - 1; i++) {
          if (sortedTiers[i].credits <= input.credits && sortedTiers[i + 1].credits >= input.credits) {
            lowerTier = sortedTiers[i];
            upperTier = sortedTiers[i + 1];
            break;
          }
        }
        
        // Handle out of range
        if (input.credits < sortedTiers[0].credits) {
          const unitPrice = Number(sortedTiers[0].unitPrice);
          return {
            price: Math.round(input.credits * unitPrice),
            unitPrice,
            isExact: false,
          };
        }
        
        if (input.credits > sortedTiers[sortedTiers.length - 1].credits) {
          const unitPrice = Number(sortedTiers[sortedTiers.length - 1].unitPrice);
          return {
            price: Math.round(input.credits * unitPrice),
            unitPrice,
            isExact: false,
          };
        }
        
        // Linear interpolation
        const ratio = (input.credits - lowerTier.credits) / (upperTier.credits - lowerTier.credits);
        const interpolatedPrice = Number(lowerTier.price) + ratio * (Number(upperTier.price) - Number(lowerTier.price));
        const unitPrice = interpolatedPrice / input.credits;
        
        return {
          price: Math.round(interpolatedPrice),
          unitPrice: Number(unitPrice.toFixed(6)),
          isExact: false,
        };
      }),
  }),

  // Invoices Router
  invoices: router({
    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().int().optional(),
        offset: z.number().int().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return db.getInvoices(ctx.user.id, {
          search: input?.search,
          status: input?.status,
          startDate: input?.startDate ? new Date(input.startDate) : undefined,
          endDate: input?.endDate ? new Date(input.endDate) : undefined,
          limit: input?.limit,
          offset: input?.offset,
        });
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .query(async ({ ctx, input }) => {
        const invoice = await db.getInvoiceById(input.id, ctx.user.id);
        if (!invoice) return null;
        
        const items = await db.getInvoiceItems(invoice.id);
        return { ...invoice, items };
      }),
    
    getByNumber: protectedProcedure
      .input(z.object({ invoiceNumber: z.string() }))
      .query(async ({ ctx, input }) => {
        const invoice = await db.getInvoiceByNumber(input.invoiceNumber, ctx.user.id);
        if (!invoice) return null;
        
        const items = await db.getInvoiceItems(invoice.id);
        return { ...invoice, items };
      }),
    
    getNextNumber: protectedProcedure.query(async ({ ctx }) => {
      return db.getNextInvoiceNumber(ctx.user.id);
    }),
    
    create: protectedProcedure
      .input(z.object({
        items: z.array(z.object({
          credits: z.number().int().positive(),
          price: z.string(),
        })),
        walletAddress: z.string().min(1),
        customerNote: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const invoiceNumber = await db.getNextInvoiceNumber(ctx.user.id);
        
        const totalCredits = input.items.reduce((sum, item) => sum + item.credits, 0);
        const totalAmount = input.items.reduce((sum, item) => sum + Number(item.price), 0);
        
        const invoice = await db.createInvoice({
          userId: ctx.user.id,
          invoiceNumber,
          totalCredits,
          totalAmount: totalAmount.toFixed(2),
          walletAddress: input.walletAddress,
          customerNote: input.customerNote,
          status: 'pending',
        });
        
        const invoiceItems = input.items.map((item, index) => ({
          invoiceId: invoice.id,
          credits: item.credits,
          price: item.price,
          sortOrder: index,
        }));
        
        await db.createInvoiceItems(invoiceItems);
        
        const items = await db.getInvoiceItems(invoice.id);
        return { ...invoice, items };
      }),
    
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        status: z.enum(['pending', 'paid', 'cancelled']),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.updateInvoiceStatus(input.id, ctx.user.id, input.status);
      }),
    
    getStats: protectedProcedure.query(async ({ ctx }) => {
      return db.getInvoiceStats(ctx.user.id);
    }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        return db.deleteInvoice(input.id, ctx.user.id);
      }),
  }),

  // TRC20 Payment Check Router
  trc20: router({
    // Check for incoming USDT transfers to a wallet address
    checkPayment: protectedProcedure
      .input(z.object({
        walletAddress: z.string(),
        expectedAmount: z.number(),
        invoiceId: z.number().int(),
        createdAfter: z.number(), // timestamp in milliseconds
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // TronGrid API to get TRC20 transfers
          const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
          const url = `https://api.trongrid.io/v1/accounts/${input.walletAddress}/transactions/trc20?limit=20&only_to=true&contract_address=${USDT_CONTRACT}&min_timestamp=${input.createdAfter}`;
          
          const response = await fetch(url);
          const data = await response.json();
          
          if (!data.success || !data.data) {
            return { found: false, error: 'API request failed' };
          }
          
          // Look for a transfer matching the expected amount
          // USDT has 6 decimals, so we need to convert
          const expectedValue = Math.round(input.expectedAmount * 1000000).toString();
          
          const matchingTransfer = data.data.find((tx: any) => {
            return tx.value === expectedValue && tx.to === input.walletAddress;
          });
          
          if (matchingTransfer) {
            // Found matching transfer, update invoice status to paid
            await db.updateInvoiceStatus(input.invoiceId, ctx.user.id, 'paid');
            
            return {
              found: true,
              transactionId: matchingTransfer.transaction_id,
              amount: Number(matchingTransfer.value) / 1000000,
              from: matchingTransfer.from,
              timestamp: matchingTransfer.block_timestamp,
            };
          }
          
          return { found: false };
        } catch (error) {
          console.error('TRC20 check error:', error);
          return { found: false, error: 'Failed to check payment' };
        }
      }),
    
    // Get wallet balance (USDT and TRX)
    getWalletBalance: protectedProcedure
      .input(z.object({
        walletAddress: z.string(),
      }))
      .query(async ({ input }) => {
        try {
          if (!input.walletAddress) {
            return { usdtBalance: 0, trxBalance: 0 };
          }
          
          // Get TRX balance
          const accountUrl = `https://api.trongrid.io/v1/accounts/${input.walletAddress}`;
          const accountResponse = await fetch(accountUrl);
          const accountData = await accountResponse.json();
          
          let trxBalance = 0;
          let usdtBalance = 0;
          
          if (accountData.success && accountData.data && accountData.data.length > 0) {
            const account = accountData.data[0];
            // TRX balance is in SUN (1 TRX = 1,000,000 SUN)
            trxBalance = (account.balance || 0) / 1000000;
            
            // Find USDT balance in trc20 tokens
            const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
            if (account.trc20) {
              const usdtToken = account.trc20.find((token: any) => 
                Object.keys(token)[0] === USDT_CONTRACT
              );
              if (usdtToken) {
                // USDT has 6 decimals
                usdtBalance = Number(usdtToken[USDT_CONTRACT]) / 1000000;
              }
            }
          }
          
          return { usdtBalance, trxBalance };
        } catch (error) {
          console.error('Get wallet balance error:', error);
          return { usdtBalance: 0, trxBalance: 0, error: 'Failed to get balance' };
        }
      }),

    // Get recent transfers for a wallet (for debugging/display)
    getRecentTransfers: protectedProcedure
      .input(z.object({
        walletAddress: z.string(),
        limit: z.number().int().optional(),
      }))
      .query(async ({ input }) => {
        try {
          const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
          const limit = input.limit || 10;
          const url = `https://api.trongrid.io/v1/accounts/${input.walletAddress}/transactions/trc20?limit=${limit}&only_to=true&contract_address=${USDT_CONTRACT}`;
          
          const response = await fetch(url);
          const data = await response.json();
          
          if (!data.success || !data.data) {
            return { transfers: [], error: 'API request failed' };
          }
          
          const transfers = data.data.map((tx: any) => ({
            transactionId: tx.transaction_id,
            amount: Number(tx.value) / 1000000,
            from: tx.from,
            to: tx.to,
            timestamp: tx.block_timestamp,
          }));
          
          return { transfers };
        } catch (error) {
          console.error('Get transfers error:', error);
          return { transfers: [], error: 'Failed to get transfers' };
        }
      }),

    // Get all token transactions (both incoming and outgoing)
    getAllTransactions: protectedProcedure
      .input(z.object({
        walletAddress: z.string(),
        limit: z.number().int().optional(),
      }))
      .query(async ({ input }) => {
        try {
          if (!input.walletAddress) {
            return { transactions: [] };
          }
          
          const limit = input.limit || 30;
          
          // Get all TRC20 transactions (both incoming and outgoing)
          const trc20Url = `https://api.trongrid.io/v1/accounts/${input.walletAddress}/transactions/trc20?limit=${limit}`;
          const trc20Response = await fetch(trc20Url);
          const trc20Data = await trc20Response.json();
          
          // Get TRX transactions
          const trxUrl = `https://api.trongrid.io/v1/accounts/${input.walletAddress}/transactions?limit=${limit}`;
          const trxResponse = await fetch(trxUrl);
          const trxData = await trxResponse.json();
          
          const transactions: any[] = [];
          
          // Process TRC20 transactions
          if (trc20Data.success && trc20Data.data) {
            for (const tx of trc20Data.data) {
              const isIncoming = tx.to === input.walletAddress;
              const tokenSymbol = tx.token_info?.symbol || 'TRC20';
              const decimals = tx.token_info?.decimals || 6;
              const amount = Number(tx.value) / Math.pow(10, decimals);
              
              transactions.push({
                transactionId: tx.transaction_id,
                type: isIncoming ? 'in' : 'out',
                tokenType: 'TRC20',
                tokenSymbol,
                amount,
                from: tx.from,
                to: tx.to,
                timestamp: tx.block_timestamp,
                contractAddress: tx.token_info?.address || '',
              });
            }
          }
          
          // Process TRX transactions
          if (trxData.success && trxData.data) {
            for (const tx of trxData.data) {
              // Only process transfer transactions
              if (tx.raw_data?.contract?.[0]?.type === 'TransferContract') {
                const contract = tx.raw_data.contract[0].parameter.value;
                const toAddress = contract.to_address;
                const fromAddress = contract.owner_address;
                const amount = (contract.amount || 0) / 1000000; // TRX has 6 decimals
                
                // Convert hex addresses to base58
                const isIncoming = tx.raw_data.contract[0].parameter.value.to_address === input.walletAddress;
                
                // Skip if amount is 0
                if (amount > 0) {
                  transactions.push({
                    transactionId: tx.txID,
                    type: isIncoming ? 'in' : 'out',
                    tokenType: 'TRX',
                    tokenSymbol: 'TRX',
                    amount,
                    from: fromAddress,
                    to: toAddress,
                    timestamp: tx.block_timestamp,
                    contractAddress: '',
                  });
                }
              }
            }
          }
          
          // Sort by timestamp descending
          transactions.sort((a, b) => b.timestamp - a.timestamp);
          
          return { transactions: transactions.slice(0, limit) };
        } catch (error) {
          console.error('Get all transactions error:', error);
          return { transactions: [], error: 'Failed to get transactions' };
        }
      }),
  }),

  // User Settings Router
  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const settings = await db.getUserSettings(ctx.user.id);
      return settings || {
        userId: ctx.user.id,
        walletAddress: '',
        companyName: '云端寻踪搜索助手',
      };
    }),
    
    update: protectedProcedure
      .input(z.object({
        walletAddress: z.string().optional(),
        companyName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.upsertUserSettings({
          userId: ctx.user.id,
          walletAddress: input.walletAddress || '',
          companyName: input.companyName || '云端寻踪搜索助手',
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
