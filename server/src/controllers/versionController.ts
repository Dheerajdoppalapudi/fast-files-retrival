import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { 
 approveVersionService,rejectVersionService
} from '../services/approveVersionService';

import { 
  downloadVersionsService,
    listVersionsService
   } from '../services/versionService';
import path from 'path';


export const approveVersion = async (req: AuthRequest, res: Response) => {
  try {
    const { versionId } = req.params;
    const userId = req.user?.id;
    const result = await approveVersionService(versionId, userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const rejectVersion = async (req: AuthRequest, res: Response) => {
  try {
    const { versionId } = req.params;
    const userId = req.user?.id;
    const result = await rejectVersionService(versionId, userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const listVersions = async (req: AuthRequest, res: Response) => {
  try {
    const { bucketName, key } = req.params;
    const versions = await listVersionsService(bucketName, key);
    res.status(200).json(versions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};


export const downloadVersion = async (req: AuthRequest, res: Response) => {
  try {
    const { versionId } = req.params;
    const userId = req.user?.id;
    const objectPath = await downloadVersionsService(versionId, userId);
    // Stream the file for download
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(objectPath)}"`);
    res.setHeader('Content-Type', 'application/octet-stream')
    res.download(objectPath, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error while downloading the file' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};
