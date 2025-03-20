import express from 'express';
import { AuthRequest, authenticateToken, authorizeRole } from '../middleware/authMiddleware';
import { ApprovalBucketSetting, ApprovalItemSetting, getBucketSetting, getItemSetting } from '../controllers/approvalControler';

const router = express.Router();

router.get(
    '/:ItemID/ItemSetting', 
    authenticateToken, 
  getItemSetting
  );
  router.get(
    '/:bucketID/BucketSetting', 
    authenticateToken, 
  getBucketSetting
  );


  router.put(
    '/:ItemID/ItemSetting', 
    authenticateToken, 
  ApprovalItemSetting
  );
  router.put(
    '/:bucketID/BucketSetting', 
    authenticateToken, 
  ApprovalBucketSetting
  );



export default router;