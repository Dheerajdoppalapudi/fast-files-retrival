import express from 'express';
import { approveVersion, rejectVersion, listVersions } from '../controllers/versionController';
import { AuthRequest, authenticateToken, authorizeRole } from '../middleware/authMiddleware';

const router = express.Router();

router.post(
    '/:bucketName/objects/:key/versions/:versionId/approve', 
    authenticateToken, 
    approveVersion
  );
  router.post(
    '/:bucketName/objects/:key/versions/:versionId/reject', 
    authenticateToken, 
    rejectVersion
  );
  router.get(
    '/:bucketName/objects/:key/versions', 
    authenticateToken, 
    listVersions
  );
export default router;