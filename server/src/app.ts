// src/app.ts
import express from 'express';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import bucketRoutes from './routes/bucketRoutes';
import objectRoutes from './routes/objectRoutes';
import versionRoutes from './routes/versionRoutes';
import approvalRoutes from './routes/approvalRoutes';
import { errorHandler, notFound } from './middleware/errorMiddleware';
import initializeDB from './config/db';
import 'reflect-metadata';
import cors from "cors";
import { upload } from './middleware/upload';

// app.use(cors({
//   origin: '*', // Adjust according to your React app's URL
//   methods: ["GET", "POST", "PUT", "DELETE"],
//   allowedHeaders: ["Content-Type", "Authorization"]
// }));


// Initialize database on startup
initializeDB().catch(err => {
  console.error('Database initialization error:', err);
  process.exit(1);
});

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.get('/', (req, res) => {
  res.send({
    status: 'success',
    message: 'API is running',
  });
});

// Auth routes (public)
app.use('/api/accounts', authRoutes);

// Protected routes
app.use('/api/accounts', userRoutes);

app.use('/api/buckets', bucketRoutes);
app.use('/api/buckets', objectRoutes);
app.use('/api/versions', versionRoutes);
app.use('/api/approval', approvalRoutes);




// 404 Not Found Middleware
app.use(notFound);

// Global Error Handler Middleware
app.use(errorHandler);

export default app;