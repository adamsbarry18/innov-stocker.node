
import cors from 'cors';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';

const app = express();

// Configuration middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Routes de base
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: 'API is running in production mode',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? 'local',
    }
  });
});

// Vos routes API
app.get('/api/v1/users', (req, res) => {
  res.json({ 
    success: true,
    data: { message: 'Users endpoint working' }
  });
});

app.get('/api/v1/auth', (req, res) => {
  res.json({ 
    success: true,
    data: { message: 'Auth endpoint working' }
  });
});

// Export pour Vercel - OBLIGATOIRE
export default function handler(req: Request, res: Response) {
  return app(req, res);
}
