import express from 'express';
import { logError } from '../controllers/ingestController.js';

const router = express.Router();

// POST /api/v1/ingest
router.post('/ingest', logError);

export default router;