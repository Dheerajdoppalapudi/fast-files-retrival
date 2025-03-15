// controllers/objectController.ts
import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { 
  uploadObjectService, 
  getObjectService, 
  deleteObjectService, 
  listAllObjectService,
  assignPermissionToItem
} from '../services/objectService';
import { listAllBucketService } from '../services/bucketService';



export const listAllObject = async (req: AuthRequest, res: Response) => {
  try {
    const { bucketName } = req.params;
    const userId = req.user?.id;

    const ListallObjectwithUser=await listAllObjectService(userId,bucketName)
    
    res.status(200).json(ListallObjectwithUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const uploadObject = async (req: AuthRequest, res: Response) => {
  try {
    const { bucketName, key } = req.params;
    const file = req.file;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await uploadObjectService(bucketName, key, file, userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getObject = async (req: AuthRequest, res: Response) => {
  try {
    const { bucketName, key } = req.params;
    const { versionId } = req.query;
    
    const result = await getObjectService(bucketName, key, versionId as string | undefined);
    
    // For a full implementation, you'd stream the file here
    // res.download(result.filePath); 
    
    // For now, just return metadata
    res.status(200).json({
      version: result.version,
      filePath: result.filePath
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteObject = async (req: AuthRequest, res: Response) => {
  try {
    const { bucketName, key } = req.params;
    const { versionId } = req.query;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const result = await deleteObjectService(
      bucketName, 
      key, 
      userId, 
      versionId as string | undefined
    );
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



export const assignPermission=async (req: AuthRequest, res: Response) =>{


   try {
      
    const { itemID,userEmail } = req.params;
    const userId = req.user?.id;

    console.log(itemID)

    if (itemID==undefined || itemID==null){
      return res.status(500).json({ error: 'Item is not provided' });
    }

    if (userEmail==undefined||itemID==null) {
      return res.status(500).json({ error: 'User Email is not provided' });
    }
    

    const result = await assignPermissionToItem(
      userId,
      itemID,
      userEmail

      
    );
   
    res.status(200).json(result);
    } catch (error) {
  
      res.status(500).json({ error: error.message });
      
    }



}