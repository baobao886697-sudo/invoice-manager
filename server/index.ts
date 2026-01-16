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
