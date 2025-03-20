import express from 'express';
import { uploadObject, getObject, deleteObject,listAllObject ,assignPermission, revokePermission, listUserAccessOfItem} from '../controllers/objectController';

import { upload } from '../middleware/upload';
import { AuthRequest, authenticateToken, authorizeRole } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/listAllObject/:bucketName',authenticateToken, listAllObject);
router.put('/:bucketId/objects/:key',authenticateToken, upload.single('file'), uploadObject);
router.get('/:itemID/listuserAcessOfItem', authenticateToken, listUserAccessOfItem);
router.put('/:itemID/assignItemPermission/:userEmail/:permissionType', authenticateToken, assignPermission);
router.delete('/:itemID/revokeItemPermission/:userEmail', authenticateToken, revokePermission);

router.get('/:bucketName/objects/:key', authenticateToken,getObject);
router.delete('/:ItemId/objects',authenticateToken, deleteObject);
// Version routes




export default router;