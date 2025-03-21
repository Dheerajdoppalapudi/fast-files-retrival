// controllers/bucketController.ts
import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { 
  createBucketService,
  assignBucketPermission ,
  listBucketContentsService,listAllBucketService,
  revokeBucketPermission,
  listFilesByExtensionService,
  getUserAccessList,
  ApprovalItemList,
  deleteBucketService
} from '../services/bucketService';


export const listAllBucket = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const bucket = await listAllBucketService (userId);
    res.status(200).json( bucket );
  }
  catch (error){
    res.status(500).json({ error: (error as Error).message });
  }
}

export const listBucketContentswithExtension = async (req: AuthRequest, res: Response) => {

  try{
  const userId = req.user?.id;
  // Get bucketId from query params, if not provided, will show root level
  const {extension}=req.params

  const contents = await listFilesByExtensionService(userId,extension );
  res.status(200).json(contents);
} catch (error) {
  res.status(500).json({ error: (error as Error).message });


}
}

export const listBucketContents = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    // Get bucketId from query params, if not provided, will show root level
    const bucketId = req.query.bucketId && req.query.bucketId!= '-1' ? req.query.bucketId : undefined;
    const contents = await listBucketContentsService(userId, bucketId?.toString());
    res.status(200).json(contents);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};


export const createBucket = async (req: AuthRequest, res: Response) => {
  try {
    const { bucketName} = req.params;
    const { parentId } = req.query; // Allow passing parent bucket ID as query param
    const userId = req.user?.id;
    const bucket = await createBucketService(bucketName, userId, parentId ? parentId : null);
    res.status(200).json({ message: 'Bucket created successfully', bucket });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const listUserAccessOfBucket = async (req: AuthRequest, res: Response) => {
  try {
    const { bucketId } = req.params;
    const userId = req.user?.id;

    if (!bucketId) {
      res.status(400).json({ error: 'BucketID is not provided' });
      return;
    }
    const result = await getUserAccessList(bucketId, userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};


export const assignPermission = async (req: AuthRequest, res: Response) => {
  try {
    const { bucketId, userEmail,permissionType } = req.params;
    const userId = req.user?.id;

    if (!bucketId) {
      res.status(400).json({ error: 'BucketID is not provided' });
      return;
    }
    if(!permissionType ||permissionType===undefined){
      res.status(400).json({ error: 'Permission Type is not given' });
      return;
    }
    const result = await assignBucketPermission(bucketId, userId, userEmail,permissionType);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const revokePermission = async (req: AuthRequest, res: Response) => {
  try {
    const { bucketId, userEmail } = req.params;
    const userId = req.user?.id;
    if (!bucketId) {
      res.status(400).json({ error: 'BucketID is not provided' });
      return;
    }
    const result = await revokeBucketPermission(bucketId, userId, userEmail);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};


export const ApprovalItem = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const result = await ApprovalItemList(userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }

}

export const deleteBucket = async (req: AuthRequest, res: Response) => {
  try {
    const { bucketId } = req.params;
    const userId = req.user?.id;
    const result = await deleteBucketService (userId,bucketId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }

}
