// controllers/objectController.ts
import { Request, Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import {
  uploadObjectService,
  getObjectService,
  deleteObjectService,
  listAllObjectService,
  assignPermissionToItem,
  revokePermissionFromItem,
  getUserAccessListForItem,
} from "../services/objectService";
import { listAllBucketService } from "../services/bucketService";

export const listAllObject = async (req: AuthRequest, res: Response) => {
  try {
    const { bucketName } = req.params;
    const userId = req.user?.id;

    const ListallObjectwithUser = await listAllObjectService(
      userId,
      bucketName
    );

    res.status(200).json(ListallObjectwithUser);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const uploadObject = async (req: AuthRequest, res: Response) => {
  try {
    const { bucketId, key } = req.params;
    const file = req.file;
    const notes=req.body.notes;
    const userId = req.user?.id;

    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const result = await uploadObjectService(bucketId, key, file, userId,notes);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getObject = async (req: AuthRequest, res: Response) => {
  try {
    const { bucketName, key } = req.params;
    const { versionId } = req.query;

    const result = await getObjectService(
      bucketName,
      key,
      versionId as string | undefined
    );

    // For a full implementation, you'd stream the file here
    // res.download(result.filePath);

    // For now, just return metadata
    res.status(200).json({
      version: result.version,
      filePath: result.filePath,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const deleteObject = async (req: AuthRequest, res: Response) => {
  try {
    const { ItemId } = req.params;
    const { versionId } = req.query;
    const userId = req.user?.id;
   
    const result = await deleteObjectService(
      ItemId,
      userId,
      versionId
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const assignPermission = async (req: AuthRequest, res: Response) => {
  try {
    const { itemID, userEmail, permissionType } = req.params;
    const userId = req.user?.id;

    if (itemID == undefined || itemID == null) {
      res.status(400).json({ error: "Item is not provided" });
      return;
    }

    if (userEmail == undefined || userEmail == null) {
      res.status(400).json({ error: "User Email is not provided" });
      return;
    }

    if (!permissionType || permissionType === undefined) {
      res.status(400).json({ error: "Permission Type is not given" });
      return;
    }

    const result = await assignPermissionToItem(
      userId,
      itemID,
      userEmail,
      permissionType
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const revokePermission = async (req: AuthRequest, res: Response) => {
  try {
    const { itemID, userEmail } = req.params;
    const userId = req.user?.id;

    if (itemID == undefined || itemID == null) {
      res.status(400).json({ error: "Item is not provided" });
      return;
    }
    if (userEmail == undefined || userEmail == null) {
      res.status(400).json({ error: "User Email is not provided" });
      return;
    }

    const result = await revokePermissionFromItem(userId, itemID, userEmail);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const listUserAccessOfItem = async (req: AuthRequest, res: Response) => {
  try {
    const { itemID } = req.params;
    const userId = req.user?.id;

    if (itemID == undefined || itemID == null) {
      res.status(400).json({ error: "Item is not provided" });
      return;
    }
    const result = await getUserAccessListForItem(userId, itemID);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

