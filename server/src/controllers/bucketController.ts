// controllers/bucketController.ts
import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { 
  createBucketService,
  assignBucketPermission ,
  listBucketContentsService,listAllBucketService
} from '../services/bucketService';


export const listAllBucket = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const bucket = await listAllBucketService (userId);
    res.status(200).json( bucket );
  }
  catch (error){
    res.status(500).json({ error: error.message });
  }
}


export const listBucketContents = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    // Get bucketId from query params, if not provided, will show root level
    const bucketId = req.query.bucketId && req.query.bucketId!= '-1' ? parseInt(req.query.bucketId as string) : undefined;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const contents = await listBucketContentsService(userId, bucketId);
    res.status(200).json(contents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createBucket = async (req: AuthRequest, res: Response) => {
  try {
    const { bucketName} = req.params;
    const { parentId } = req.query; // Allow passing parent bucket ID as query param
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const bucket = await createBucketService(bucketName, userId, parentId ? parseInt(parentId as string) : null);
    res.status(200).json({ message: 'Bucket created successfully', bucket });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const assignPermission = async (req: AuthRequest, res: Response) => {
  try {
    const { bucketId, userEmail } = req.params;
    const userId = req.user?.id;


    if(!bucketId){
      return res.status(500).json({ error: 'BucketID is not provided' });
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const result = await assignBucketPermission(bucketId, userId, userEmail);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};