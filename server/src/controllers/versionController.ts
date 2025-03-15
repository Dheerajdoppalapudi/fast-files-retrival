import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { 
 approveVersionService,rejectVersionService
} from '../services/approveVersionService';

import { 
    listVersionsService
   } from '../services/versionService';


export const approveVersion = async (req: AuthRequest, res: Response) => {
  try {
    const { versionId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const result = await approveVersionService(versionId, userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const rejectVersion = async (req: AuthRequest, res: Response) => {
  try {
    const { versionId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const result = await rejectVersionService(versionId, userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const listVersions = async (req: AuthRequest, res: Response) => {
  try {
    const { bucketName, key } = req.params;
    const versions = await listVersionsService(bucketName, key);
    res.status(200).json(versions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};