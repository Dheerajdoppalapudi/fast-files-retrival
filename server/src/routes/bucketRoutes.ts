import express from 'express';
import { createBucket,assignPermission ,listAllBucket,listBucketContents,revokePermission} from '../controllers/bucketController';
import { AuthRequest, authenticateToken, authorizeRole } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', authenticateToken, listBucketContents);
router.get('/listAllBucket',authenticateToken, listAllBucket);
router.put('/:bucketName',authenticateToken, createBucket);
router.put('/:bucketId/assignBucketPermission/:userEmail/:permissionType', authenticateToken, assignPermission);
router.delete('/:bucketId/revokeBucketPermission/:userEmail', authenticateToken, revokePermission);


export default router;