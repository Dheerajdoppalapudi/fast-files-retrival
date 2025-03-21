import { executeTransaction } from '../utils/transactionUtils';
import { PermissionService } from './PermissionService';
import { getObjectPath, deleteFile } from '../utils/storage';
import { ObjectVersion } from '../models/ObjectVersion';
import { AppDataSource } from '../config/db';
import { Bucket } from '../models/Bucket';
import { MyItem } from '../models/Myitem';
import { Approval } from '../models/Approval';
import { In, QueryRunner } from 'typeorm';
import { Approver } from '../models/Approver';

const permissionService = new PermissionService();

/**
 * Checks if the user has approval permission for a given version.
 */
const hasApprovalPermission = async (
  queryRunner: QueryRunner,
  userId: string,
  itemId: string,
  versionId: string
): Promise<boolean> => {
  // First, check if the user is an admin (Admins have full access)
  const isAdmin = await permissionService.isAdmin(userId);
  if (isAdmin) {
    return true; // Admin has full access
  }

  // Fetch user approver groups for the specific item
  const userApproverGroups = await queryRunner.manager
    .getRepository(Approver)
    .createQueryBuilder('approver')
    .innerJoin('approver.users', 'user', 'user.id = :userId', { userId })
    .andWhere('approver.name LIKE :namePattern', { namePattern: `file_${itemId}%` })
    .getMany();

  if (!userApproverGroups.length) {
    return false; // User is not in any approver group
  }

  const userApproverIds = userApproverGroups.map((group) => group.id);
  // Check if there is a pending approval for the user
  const pendingApproval = await queryRunner.manager.getRepository(Approval).findOne({
    where: {
      objectVersionId: versionId,
      approverId: In(userApproverIds),
      decision: 'pending',
    },
  });

  return !!pendingApproval; // Return true if a pending approval exists
};


/**
 * Approves a version.
 */
export const approveVersionService = async (
  versionId: string, 
  userId: string
): Promise<{ message: string; version: ObjectVersion }> => {
  return executeTransaction(async (queryRunner) => {
    const versionRepository = queryRunner.manager.getRepository(ObjectVersion);
    const version = await versionRepository.findOne({ where: { id: versionId } });
    if (!version) throw new Error('Version not found');

    const myItem = await queryRunner.manager.getRepository(MyItem).findOne({ where: { id: version.objectId } });
    if (!myItem) throw new Error('Item not found');

    if (version.status === 'approved') {
      return { message: 'Version already approved', version };
    }

    // Check if the user has permission to approve
    const hasPermission = await hasApprovalPermission(queryRunner, userId, myItem.id, version.id);
    if (!hasPermission) {
      throw new Error('You do not have permission to approve this version');
    }

    const approvalRepository = queryRunner.manager.getRepository(Approval);
    const pendingApproval = await approvalRepository.findOne({
      where: {
        objectVersionId: version.id,
        decision: 'pending',
      },
    });

    if (pendingApproval) {
      pendingApproval.decision = 'approved';
      pendingApproval.comments = `Approved by User ID: ${userId}`;
      await approvalRepository.save(pendingApproval);
    }

    // Mark the version as approved
    version.status = 'approved';
    version.isLatest = true;
    
    // Mark all other versions as not latest
    await versionRepository.update({ objectId: version.objectId, isLatest: true }, { isLatest: false });

    await versionRepository.save(version);
    return { message: 'Version approved successfully', version };
  });
};

/**
 * Rejects a version.
 */
export const rejectVersionService = async (
  versionId: string,
  userId: string
): Promise<{ message: string; version: ObjectVersion }> => {
  return executeTransaction(async (queryRunner) => {
    const versionRepository = queryRunner.manager.getRepository(ObjectVersion);
    const version = await versionRepository.findOne({ where: { id: versionId } });
    if (!version) throw new Error('Version not found');

    const myItem = await queryRunner.manager.getRepository(MyItem).findOne({ where: { id: version.objectId } });
    if (!myItem) throw new Error('Item not found');

    if (version.status === 'rejected') {
      return { message: 'Version already rejected', version };
    }

    // Check if the user has permission to reject
    const hasPermission = await hasApprovalPermission(queryRunner, userId, myItem.id, version.id);
    if (!hasPermission) {
      throw new Error('You do not have permission to reject this version');
    }

    const approvalRepository = queryRunner.manager.getRepository(Approval);
    const pendingApproval = await approvalRepository.findOne({
      where: {
        objectVersionId: version.id,
        decision: 'pending',
      },
    });

    if (pendingApproval) {
      pendingApproval.decision = 'rejected';
      pendingApproval.comments = `Rejected by User ID: ${userId}`;
      await approvalRepository.save(pendingApproval);
    }

    // Get the bucket associated with the item
    const bucket = await queryRunner.manager.getRepository(Bucket).findOne({ where: { id: myItem.bucketId } });
    if (!bucket) throw new Error('Bucket not found');

    // Delete the file
    const objectPath = getObjectPath(bucket.name, myItem.key, version.id);
    deleteFile(objectPath);

    // Mark the version as rejected
    version.status = 'rejected';
    await versionRepository.save(version);

    return { message: 'Version rejected successfully', version };
  });
};
