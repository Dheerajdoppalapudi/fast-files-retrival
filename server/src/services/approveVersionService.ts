import { executeTransaction } from '../utils/transactionUtils';
import { PermissionService } from './PermissionService';
import { getObjectPath, deleteFile } from '../utils/storage';
import { ObjectVersion } from '../models/ObjectVersion';
import { AppDataSource } from '../config/db';
import { Bucket } from '../models/Bucket';
import { MyItem } from '../models/Myitem';

const permissionService = new PermissionService();

export const approveVersionService = async (
  versionId: string, 
  userId: number
): Promise<{ message: string; version: ObjectVersion }> => {
  return executeTransaction(async (queryRunner) => {
    const versionRepository = queryRunner.manager.getRepository(ObjectVersion);

    const version = await versionRepository.findOne({ where: { versionId } });
    if (!version) throw new Error('Version not found');

    // Get the item associated with the version
    const myItem = await queryRunner.manager.getRepository(MyItem).findOne({ 
      where: { id: version.objectId } 
    });
    if (!myItem) throw new Error('Item not found');

    // Check if version is already approved
    if (version.status === 'approved') {
      return { message: 'Version already approved', version };
    }

    // Allow self-approval only for the item owner
    if (version.userId === userId && myItem.userId !== userId) {
      throw new Error('You cannot approve your own version unless you are the item owner');
    }

    // For non-owners, check if they have item-level permissions
    if (myItem.userId !== userId) {
      const hasWritePermission = await permissionService.hasItemPermission(userId, myItem.id, 'write');
      if (!hasWritePermission) {
        throw new Error('You do not have permission to approve this version');
      }
    }

    // Mark the version as approved
    version.status = 'approved';
    version.isLatest = true;

    // Mark all other versions as not latest
    await versionRepository.update(
      { objectId: version.objectId, isLatest: true },
      { isLatest: false }
    );

    await versionRepository.save(version);
    return { message: 'Version approved successfully', version };
  });
};
  
  export const rejectVersionService = async (
    versionId: string,
    userId: number
  ): Promise<{ message: string; version: ObjectVersion }> => {
    return executeTransaction(async (queryRunner) => {
      const versionRepository = queryRunner.manager.getRepository(ObjectVersion);
  
      const version = await versionRepository.findOne({ where: { versionId } });
      if (!version) throw new Error('Version not found');
  
      // Get the item associated with the version
      const myItem = await queryRunner.manager.getRepository(MyItem).findOne({ 
        where: { id: version.objectId } 
      });
      if (!myItem) throw new Error('Item not found');
  
      // Check permissions
      if (version.userId !== userId) {
        const hasWritePermission = await permissionService.hasItemPermission(userId, myItem.id, 'write');
        if (!hasWritePermission) {
          throw new Error('You do not have permission to reject this version');
        }
      }
  
      // Get the bucket associated with the item
      const bucket = await queryRunner.manager.getRepository(Bucket).findOne({ 
        where: { id: myItem.bucketId } 
      });
      if (!bucket) throw new Error('Bucket not found');
  
      // Delete the file
      const objectPath = getObjectPath(bucket.name, myItem.key, version.versionId);
      deleteFile(objectPath);
  
      // Mark the version as rejected
      version.status = 'rejected';
      await versionRepository.save(version);
  
      return { message: 'Version rejected successfully', version };
    });
  };
  