// services/versionService.ts (continued)
import { AppDataSource } from '../config/db';
import { Bucket } from '../models/Bucket';
import { MyItem } from '../models/Myitem';
import { ObjectVersion } from '../models/ObjectVersion';
import { executeTransaction } from '../utils/transactionUtils';
import { PermissionService } from './PermissionService';
import { getObjectPath, deleteFile } from '../utils/storage';
import fs from 'fs';

const permissionService = new PermissionService();



export const downloadVersionsService = async (
  versionId: string,
  userId: string
): Promise<{ objectPath: string; objectName: string }> => {
  return executeTransaction(async (queryRunner) => {
    const versionRepository = queryRunner.manager.getRepository(ObjectVersion);
    const myItemRepository = queryRunner.manager.getRepository(MyItem);
    const bucketRepository = queryRunner.manager.getRepository(Bucket);

    // Fetch version details
    const version = await versionRepository.findOne({
      where: { id: versionId },
      select: ['id', 'objectId'], // Fetch only required fields
    });

    if (!version) {
      throw new Error('Version not found.');
    }

    // Fetch item details
    const myItem = await myItemRepository.findOne({
      where: { id: version.objectId },
      select: ['id', 'userId', 'key', 'bucketId'],
    });

    if (!myItem) {
      throw new Error('Item associated with the version not found.');
    }

    // Check permissions if the user is not the owner
    if (myItem.userId !== userId) {
      const hasAccess =
        (await permissionService.hasItemPermission(userId, myItem.id)) ||
        (await permissionService.hasItemPermission(userId, myItem.id, 'view'));

      if (!hasAccess) {
        throw new Error('You do not have permission to download this file.');
      }
    }

    // Fetch bucket details
    const bucket = await bucketRepository.findOne({
      where: { id: myItem.bucketId },
      select: ['name'],
    });

    if (!bucket) {
      throw new Error('Bucket associated with the item not found.');
    }

    // Get object storage path
    const objectPath = getObjectPath(bucket.name, myItem.key, version.id);

    // Ensure the file exists
    if (!fs.existsSync(objectPath)) {
      throw new Error('File not found on the server.');
    }

    return {
      objectPath,
      objectName: myItem.key,
    };
  });
};
