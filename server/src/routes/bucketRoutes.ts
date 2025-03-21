import express from 'express';
import { createBucket,assignPermission ,listAllBucket,listBucketContents,revokePermission,listBucketContentswithExtension,listUserAccessOfBucket, ApprovalItem, deleteBucket} from '../controllers/bucketController';
import { AuthRequest, authenticateToken, authorizeRole } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', authenticateToken, listBucketContents);
router.get('/extension/:extension', authenticateToken, listBucketContentswithExtension);
router.get('/listAllBucket',authenticateToken, listAllBucket);
router.put('/:bucketName',authenticateToken, createBucket);
router.get('/:bucketId/listUserAcessOfBucket', authenticateToken, listUserAccessOfBucket);
router.put('/:bucketId/assignBucketPermission/:userEmail/:permissionType', authenticateToken, assignPermission);
router.delete('/:bucketId/revokeBucketPermission/:userEmail', authenticateToken, revokePermission);
router.get('/Approvals',authenticateToken,ApprovalItem)
router.delete('/:bucketId/bucket',authenticateToken, deleteBucket);


export default router;