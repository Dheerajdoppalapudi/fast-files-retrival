import express from 'express';
import { approveVersion, rejectVersion,downloadVersion, ExtractText, ComparePDF } from '../controllers/versionController';
import { AuthRequest, authenticateToken, authorizeRole } from '../middleware/authMiddleware';

const router = express.Router();

router.put(
    '/:versionId/approve', 
    authenticateToken, 
    approveVersion
  );
  router.put(
    '/:versionId/reject', 
    authenticateToken, 
    rejectVersion
  );

  router.get(
    '/download/:versionId', 
    authenticateToken, 
    downloadVersion
  );

  router.get(
    '/extractText/:versionId', 
    authenticateToken, 
    ExtractText
  );

  router.get(
    '/versionA/:versionIdA/versionB/:versionIdB', 
    authenticateToken, 
    ComparePDF
  );
export default router;