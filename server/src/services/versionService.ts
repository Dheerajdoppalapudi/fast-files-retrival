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
): Promise<{objectPath: string,objectName:string}> => {
  return executeTransaction(async (queryRunner) => {
    const bucketRepository = queryRunner.manager.getRepository(Bucket);
    const myItemRepository = queryRunner.manager.getRepository(MyItem);
    const versionRepository = queryRunner.manager.getRepository(ObjectVersion);

    const version = await versionRepository.findOne({
      where: { id:versionId },
    });

    if (!version) {
      throw new Error('Unable to find this version');
    }

    const myItem = await myItemRepository.findOne({
      where: { id: version.objectId },
    });

    if (!myItem) {
      throw new Error('Unable to find this version');
    }

    if (myItem.userId !== userId) {
      const hasWritePermission =
        (await permissionService.hasItemPermission(userId, myItem.id)) ||
        (await permissionService.hasItemPermission(userId, myItem.id, 'view'));

      if (!hasWritePermission) {
        throw new Error('You do not have permission to download this file');
      }
    }

    const bucket = await bucketRepository.findOne({
      where: { id: myItem.bucketId },
    });

    if (!bucket) {
      throw new Error('Unable to find this version');
    }

    const objectPath = getObjectPath(bucket.name, myItem.key, version.id);

    if (!fs.existsSync(objectPath)) {
      throw new Error('File not found');
    }

    return {
      objectPath:objectPath,
      objectName:myItem.key

    }; // Return file path
  });
};


