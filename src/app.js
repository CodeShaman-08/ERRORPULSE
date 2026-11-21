import express from 'express';
import cors from 'cors';
import ingestRoute from './routes/ingestRoute.js';
import issueRoute from './routes/issueRoute.js';
import analyticsRoute from './routes/analyticsRoute.js';
import branchRoute from './routes/branchRoute.js';

const app = express();

app.use(cors());
app.use(express.json());

// Ingestion API (used by client apps / SDK)
app.use('/api/v1', ingestRoute);

// Dashboard APIs
app.use('/api/v1/issues', issueRoute);
app.use('/api/v1/analytics', analyticsRoute);
app.use('/api/v1/branches', branchRoute);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

export default app;