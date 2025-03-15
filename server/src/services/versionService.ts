// services/versionService.ts (continued)
import { AppDataSource } from '../config/db';
import { Bucket } from '../models/Bucket';
import { MyItem } from '../models/Myitem';
import { ObjectVersion } from '../models/ObjectVersion';
import { executeTransaction } from '../utils/transactionUtils';
import { PermissionService } from './PermissionService';
import { getObjectPath, deleteFile } from '../utils/storage';

const permissionService = new PermissionService();


export const listVersionsService = async (
  bucketName: string, 
  key: string
): Promise<{
  bucketName: string;
  key: string;
  versioningEnabled: boolean;
  versions: any[];
}> => {
  const bucketRepository = AppDataSource.getRepository(Bucket);
  const myItemRepository = AppDataSource.getRepository(MyItem);
  const versionRepository = AppDataSource.getRepository(ObjectVersion);

  const bucket = await bucketRepository.findOne({ where: { name: bucketName } });
  if (!bucket) throw new Error('Bucket not found');

  const myItem = await myItemRepository.findOne({ where: { bucketId: bucket.id, key } });
  if (!myItem) throw new Error('Object not found');

  const versions = await versionRepository.find({
    where: { objectId: myItem.id },
    order: { createdAt: 'DESC' },
  });

  return {
    bucketName,
    key,
    versioningEnabled: myItem.versioningEnabled,
    versions: versions.map(v => ({
      versionId: v.versionId,
      size: v.size,
      etag: v.etag,
      isLatest: v.isLatest,
      deleteMarker: v.deleteMarker,
      status: v.status,
      lastModified: v.createdAt,
    })),
  };
};