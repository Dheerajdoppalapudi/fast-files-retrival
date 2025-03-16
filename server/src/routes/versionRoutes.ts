import express from 'express';
import { approveVersion, rejectVersion, listVersions,downloadVersion } from '../controllers/versionController';
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
    '/:bucketName/objects/:key/versions', 
    authenticateToken, 
    listVersions
  );

  router.get(
    '/download/:versionId', 
    authenticateToken, 
    downloadVersion
  );
export default router;