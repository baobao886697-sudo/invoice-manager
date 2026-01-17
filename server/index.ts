import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './routers';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Fixed admin user for simple password authentication
const ADMIN_USER = {
  id: 1,
  openId: "admin",
  name: "管理员",
  email: "admin@local",
  loginMethod: "password",
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// tRPC API
app.use('/api/trpc', createExpressMiddleware({
  router: appRouter,
  createContext: ({ req }) => {
    // Check for simple password auth header
    const authHeader = req.headers["x-simple-auth"];
    const isAuthenticated = authHeader === "true";
    
    return {
      req,
      res: {} as any,
      user: isAuthenticated ? ADMIN_USER : null,
    };
  },
}));

// REST API for TRC20 transfers query (non-tRPC endpoint for simpler frontend access)
app.get('/api/trc20/transfers', async (req, res) => {
  try {
    const { address, limit = '10' } = req.query;
    
    if (!address || typeof address !== 'string') {
      return res.json({ success: false, error: 'Missing address parameter' });
    }
    
    const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
    const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?limit=${limit}&only_to=true&contract_address=${USDT_CONTRACT}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.success || !data.data) {
      return res.json({ success: false, error: 'TronGrid API request failed' });
    }
    
    const transfers = data.data.map((tx: any) => ({
      transactionId: tx.transaction_id,
      amount: Number(tx.value) / 1000000,
      from: tx.from,
      to: tx.to,
      timestamp: tx.block_timestamp,
    }));
    
    return res.json({ success: true, transfers });
  } catch (error) {
    console.error('TRC20 transfers query error:', error);
    return res.json({ success: false, error: 'Failed to query transfers' });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../dist/client');
  app.use(express.static(clientPath));
  
  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
