import express from 'express';
import { uploadObject, getObject, deleteObject,listAllObject ,assignPermission} from '../controllers/objectController';


import { upload } from '../middleware/upload';
import { AuthRequest, authenticateToken, authorizeRole } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/listAllObject/:bucketName',authenticateToken, listAllObject);
router.put('/:bucketName/objects/:key',authenticateToken, upload.single('file'), uploadObject);
router.put('/:itemID/assignItemPermission/:userEmail', authenticateToken,assignPermission)
router.get('/:bucketName/objects/:key', authenticateToken,getObject);
router.delete('/:bucketName/objects/:key',authenticateToken, deleteObject);
// Version routes

  
export default router;