import { AppDataSource } from '../config/db';
import { MyItem } from '../models/Myitem';
import { Bucket } from '../models/Bucket';
import { ObjectVersion } from '../models/ObjectVersion';
import { executeTransaction } from '../utils/transactionUtils';
import { PermissionService } from './PermissionService';
import { getObjectPath, calculateETag, deleteFile } from '../utils/storage';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { Permission } from '../models/Permission';
import { User } from '../models/userModel';
import { Approver } from '../models/Approver';
import { Approval } from '../models/Approval';

const permissionService = new PermissionService();


export const listAllObjectService = async (userId: number, bucketName?: string): Promise<any> => {
  return executeTransaction(async (queryRunner) => {
    const itemRepository = queryRunner.manager.getRepository(MyItem);
    const permissionRepository = queryRunner.manager.getRepository(Permission);
    const bucketRepository = queryRunner.manager.getRepository(Bucket);

    let bucketFilter: { bucketId?: number } = {};

    // Fetch bucket if bucketName is provided
    if (bucketName) {
      const bucket = await bucketRepository.findOne({ where: { name: bucketName } });
      if (!bucket) return []; // If bucket doesn't exist, return empty array
      bucketFilter.bucketId = bucket.id;
    }

    // Fetch owned items with sorted versions
    const ownedItems = await itemRepository.find({
      where: { userId, ...bucketFilter },
      relations: ['bucket', 'permissions', 'versions'],
      order: { versions: { createdAt: 'DESC' } }, // Sort versions by latest first
    });

    // Fetch permitted items with sorted versions
    const permittedItems = await permissionRepository
      .createQueryBuilder('permission')
      .leftJoinAndSelect('permission.item', 'item')
      .leftJoinAndSelect('item.bucket', 'bucket')
      .leftJoinAndSelect('item.versions', 'versions')
      .where('permission.userId = :userId', { userId })
      .andWhere('permission.itemId IS NOT NULL');

    if (bucketName) {
      permittedItems.andWhere('bucket.name = :bucketName', { bucketName });
    }

    const permittedItemsList = await permittedItems
      .orderBy('versions.createdAt', 'DESC') // Ensure sorting at query level
      .getMany();

    // Extract unique items from permissions
    const accessItems = permittedItemsList.map((perm) => perm.item).filter((item) => item !== null);

    // Combine both owned and accessible items into a unique list
    const uniqueItems = new Map<number, MyItem>();
    [...ownedItems, ...accessItems].forEach((item) => {
      if (item) uniqueItems.set(item.id, item);
    });

    // Remove userId before returning
    return Array.from(uniqueItems.values()).map(({ userId, ...item }) => item);
  });
};


export const uploadObjectService = async (
  bucketName: string,
  key: string,
  file: Express.Multer.File,
  userId: any,
  parentId?: number
): Promise<{ key: string; versionId: string; etag: string; status: string }> => {
  return executeTransaction(async (queryRunner) => {
    const bucketRepository = queryRunner.manager.getRepository(Bucket);
    const myItemRepository = queryRunner.manager.getRepository(MyItem);
    const versionRepository = queryRunner.manager.getRepository(ObjectVersion);
    const approverRepository = queryRunner.manager.getRepository(Approver);
    const approvalRepository = queryRunner.manager.getRepository(Approval);
    const userRepository = queryRunner.manager.getRepository(User);

    // Get the bucket
    const bucket = await bucketRepository.findOne({ where: { name: bucketName, parentId } });
    if (!bucket) throw new Error('Bucket not found');

    // Check bucket permissions if user is not the owner
    if (bucket.userId !== userId) {
      const hasWritePermission = await permissionService.hasBucketPermission(userId, bucket.id, 'write');
      if (!hasWritePermission) {
        throw new Error('You do not have permission to write to this bucket');
      }
    }

    // Get or create the item
    let myItem = await myItemRepository.findOne({ where: { bucketId: bucket.id, key } });
    let isFirstUpload = false;
    
    if (!myItem) {
      // Create new item
      myItem = new MyItem();
      myItem.bucketId = bucket.id;
      myItem.key = key;
      myItem.userId = userId;
      myItem.versioningEnabled = true; // Enable versioning by default

      // Inherit approval settings from bucket if applicable
      if (bucket.requiresApproval) {
        myItem.requiresApproval = true;
        myItem.approvalStatus = 'pending';
        
        // Inherit default approver from bucket if it exists
        if (bucket.defaultApproverId) {
          myItem.defaultApproverId = bucket.defaultApproverId;
        }
      }

      myItem = await myItemRepository.save(myItem);
      isFirstUpload = true;
      
      // Create permissions for the item owner
      await permissionService.assignItemPermission(userId, myItem.id);
      
      // If approval required and no default approver inherited, create an approver group
      if (myItem.requiresApproval && !myItem.defaultApproverId) {
        const ownerApprover = new Approver();
        ownerApprover.name = `Approvers for ${key}`;
        ownerApprover.isGroup = false;
        ownerApprover.approvalType = 'standard';
        ownerApprover.minApprovals = 1;
        
        // Save the approver group
        const savedApprover = await approverRepository.save(ownerApprover);
        
        // Associate the current user with this approver group
        await queryRunner.manager.query(
          `INSERT INTO approver_users (approverId, userId) VALUES (?, ?)`,
          [savedApprover.id, userId]
        );
        
        // Set as default approver for the item
        myItem.defaultApproverId = savedApprover.id;
        await myItemRepository.save(myItem);
      }
    } else if (myItem.userId !== userId) {
      // Check item-level permissions for existing item
      const hasWritePermission = await permissionService.hasItemPermission(userId, myItem.id, 'write');
      if (!hasWritePermission) {
        throw new Error('You do not have permission to modify this item');
      }
    }

    // Calculate the ETag of the uploaded file
    const etag = await calculateETag(file.path);

    // Check if the latest approved version has the same ETag (no changes)
    const latestVersion = await versionRepository.findOne({
      where: { objectId: myItem.id, isLatest: true },
    });

    if (latestVersion && latestVersion.etag === etag) {
      // No changes in the file, return
      throw new Error('No changes detected in files'); 
    }

    // Create a new version
    const versionId = uuidv4();
    const newVersion = new ObjectVersion();
    newVersion.objectId = myItem.id;
    newVersion.versionId = versionId;
    newVersion.userId = userId;
    newVersion.size = file.size;
    newVersion.etag = etag;
    newVersion.deleteMarker = false;
    
    // Check if approval is required
    const requiresApproval = myItem.requiresApproval || bucket.requiresApproval;
    
    // Process approval requirements
    if (requiresApproval) {
      // Determine which approver group to use - prefer item-level, then bucket-level
      const approverId = myItem.defaultApproverId || bucket.defaultApproverId;
      
      if (approverId) {
        newVersion.approverId = approverId;
        
        // Get the approver group to check approval type
        const approver = await approverRepository.findOne({
          where: { id: approverId },
          relations: ['users']
        });
        
        if (approver) {
          // Check if owner auto-approval is enabled and if user is the owner
          if (shouldOwnerAutoApprove(bucket, myItem) && myItem.userId === userId) {
            // Auto-approve this version
            newVersion.status = 'approved';
            newVersion.isLatest = true;
            
            // If there's a previous latest version, mark it as not latest
            if (latestVersion) {
              await versionRepository.update(
                { objectId: myItem.id, isLatest: true },
                { isLatest: false }
              );
            }
            
            // Save the version first to get its ID
            const savedVersion = await versionRepository.save(newVersion);
            
            // Create auto-approval record
            const approval = new Approval();
            approval.objectVersionId = savedVersion.id;
            approval.approverId = approverId;
            approval.userId = userId;
            approval.decision = 'approved';
            approval.comments = 'Auto-approved by owner';
            await approvalRepository.save(approval);
          } else {
            // Needs approval process - set as pending
            newVersion.status = 'pending';

            console.log(approver)
            
            // Don't make it the latest version until approved
            newVersion.isLatest = false;
            
            // Save the version first to get its ID
            const savedVersion = await versionRepository.save(newVersion);
            
            // Create pending approval requests for all users in the approver group
            if (approver.isGroup) {
              // If approval type is unanimous, create approval entries for all users
              if (approver.approvalType === 'unanimous') {
                for (const approverUser of approver.users) {
                  const approval = new Approval();
                  approval.objectVersionId = savedVersion.id;
                  approval.approverId = approverId;
                  approval.userId = approverUser.id;
                  approval.decision = 'pending';
                  await approvalRepository.save(approval);
                }
              } else {
                // For standard approval, create one approval entry for the group
                const approval = new Approval();
                approval.objectVersionId = savedVersion.id;
                approval.approverId = approverId;
                approval.userId = null; // Will be filled when someone approves
                approval.decision = 'pending';
                await approvalRepository.save(approval);
              }
            } else {
              // Single approver case
              const approval = new Approval();
              approval.objectVersionId = savedVersion.id;
              approval.approverId = approverId;
              approval.userId = approver.users[0]?.id || null;
              approval.decision = 'pending';
              await approvalRepository.save(approval);
            }
            
            // Notify approvers about pending approval (implementation depends on notification system)
            // await notifyApprovers(approver, savedVersion, myItem, bucket, userId);
          }
        } else {
          // Approver not found, default to pending status
          newVersion.status = 'pending';
          newVersion.isLatest = false;
          await versionRepository.save(newVersion);
        }
      } else {
        // No approver defined, use default approval process
        newVersion.status = 'pending';
        newVersion.isLatest = false;
        await versionRepository.save(newVersion);
      }
    } else {
      // No approval required - auto-approve
      newVersion.status = 'approved';
      newVersion.isLatest = true;
      
      // If there's a previous latest version, mark it as not latest
      if (latestVersion) {
        await versionRepository.update(
          { objectId: myItem.id, isLatest: true },
          { isLatest: false }
        );
      }
      
      await versionRepository.save(newVersion);
    }

    // Save the file to the final location
    const objectPath = getObjectPath(bucketName, key, versionId);
    fs.renameSync(file.path, objectPath);

    return { 
      key, 
      versionId, 
      etag, 
      status: newVersion.status 
    };
  });
};

// Helper function to determine if owner should auto-approve
function shouldOwnerAutoApprove(bucket: Bucket, item: MyItem): boolean {
  // Check both bucket and item settings
  return (bucket.ownerAutoApproves === true);
}

// Helper function to notify approvers
async function notifyApprovers(
  approver: Approver, 
  version: ObjectVersion, 
  item: MyItem, 
  bucket: Bucket, 
  uploaderId: number
): Promise<void> {
  // This would integrate with your notification system
  // Implementation details will depend on your notification setup
  
  // Example implementation (modify as needed):
  try {
    // Get uploader details
    const uploader = await User.findOne({ where: { id: uploaderId } });
    const uploaderName = uploader ? uploader.name : 'Unknown user';
    
    // Prepare notification message
    const message = `New approval requested: ${item.key} in bucket ${bucket.name} uploaded by ${uploaderName}`;
    
    // Send notifications to all users in the approver group
    for (const user of approver.users) {
      // Send notification (implementation depends on your system)
      // Example: await notificationService.send(user.id, message, {
      //   type: 'approval_request',
      //   versionId: version.id,
      //   itemId: item.id,
      //   bucketId: bucket.id
      // });
      
      console.log(`Notification would be sent to user ${user.id}: ${message}`);
    }
  } catch (error) {
    console.error('Failed to send approval notifications:', error);
    // Don't throw - notification failure shouldn't block the upload
  }
}

export const getObjectService = async (
  bucketName: string, 
  key: string, 
  versionId?: string
): Promise<{ filePath: string; version: ObjectVersion }> => {
  const bucketRepository = AppDataSource.getRepository(Bucket);
  const myItemRepository = AppDataSource.getRepository(MyItem);
  const versionRepository = AppDataSource.getRepository(ObjectVersion);

  const bucket = await bucketRepository.findOne({ where: { name: bucketName } });
  if (!bucket) throw new Error('Bucket not found');

  const myItem = await myItemRepository.findOne({ where: { bucketId: bucket.id, key } });
  if (!myItem) throw new Error('Object not found');

  let version;
  if (versionId) {
    version = await versionRepository.findOne({ 
      where: { objectId: myItem.id, versionId, status: 'approved' } 
    });
    if (!version) throw new Error('Version not found or not approved');
  } else {
    version = await versionRepository.findOne({ 
      where: { objectId: myItem.id, isLatest: true, status: 'approved' } 
    });
    if (!version) throw new Error('No approved version found');
  }

  if (version.deleteMarker) throw new Error('Object deleted');

  const objectPath = getObjectPath(bucketName, key, version.versionId);
  if (!fs.existsSync(objectPath)) throw new Error('Object data not found');

  return { filePath: objectPath, version };
};

export const deleteObjectService = async (
  bucketName: string, 
  key: string, 
  userId: number, 
  versionId?: string
): Promise<{ message: string }> => {
  return executeTransaction(async (queryRunner) => {
    const bucketRepository = queryRunner.manager.getRepository(Bucket);
    const myItemRepository = queryRunner.manager.getRepository(MyItem);
    const versionRepository = queryRunner.manager.getRepository(ObjectVersion);

    // Get the bucket
    const bucket = await bucketRepository.findOne({ where: { name: bucketName } });
    if (!bucket) throw new Error('Bucket not found');

    // Get the item
    const myItem = await myItemRepository.findOne({ where: { bucketId: bucket.id, key } });
    if (!myItem) throw new Error('Item not found');

    // Check permissions
    if (myItem.userId !== userId) {
      const hasDeletePermission = await permissionService.hasItemPermission(userId, myItem.id, 'delete');
      if (!hasDeletePermission) {
        throw new Error('You do not have permission to delete this item');
      }
    }

    if (versionId) {
      // Delete specific version
      const version = await versionRepository.findOne({
        where: { objectId: myItem.id, versionId }
      });
      
      if (!version) throw new Error('Version not found');
      
      // Delete the file
      const objectPath = getObjectPath(bucketName, key, version.versionId);
      deleteFile(objectPath);
      
      // If this is the latest version, create a delete marker
      if (version.isLatest && myItem.versioningEnabled) {
        // Create a delete marker
        const deleteMarker = new ObjectVersion();
        deleteMarker.objectId = myItem.id;
        deleteMarker.versionId = uuidv4();
        deleteMarker.userId = userId;
        deleteMarker.size = 0;
        deleteMarker.etag = '';
        deleteMarker.isLatest = true;
        deleteMarker.deleteMarker = true;
        deleteMarker.status = 'approved';
        
        // Mark previous latest as not latest
        await versionRepository.update(
          { objectId: myItem.id, isLatest: true },
          { isLatest: false }
        );
        
        await versionRepository.save(deleteMarker);
        
        return { message: 'Version deleted and delete marker created' };
      } else {
        // Just delete the version
        await versionRepository.delete(version.id);
        return { message: 'Version deleted successfully' };
      }
    } else {
      // Delete all versions if versioning is disabled or if explicitly requested
      const versions = await versionRepository.find({ where: { objectId: myItem.id } });
      
      // Delete all version files
      for (const version of versions) {
        const objectPath = getObjectPath(bucketName, key, version.versionId);
        deleteFile(objectPath);
      }
      
      // Delete the item and all its versions from database
      await myItemRepository.delete(myItem.id);
      
      return { message: 'Item and all versions deleted successfully' };
    }
  });
};


export const assignPermissionToItem =async(userId: any, itemID:any,
  userEmail:string): Promise<Permission> => {
    return executeTransaction(async (queryRunner) => {

            const myItemRepository = queryRunner.manager.getRepository(MyItem);
            const existingItem = await myItemRepository.findOne({ 
              where: { id:itemID } 
            });
      
            if (!existingItem) throw new Error('Iteam is not Created Yet');
      
            if (existingItem.userId !== userId) {
              const hasWritePermission = await permissionService.hasItemPermission(userId, existingItem.id, 'write');
              if (!hasWritePermission) {
                throw new Error('You do not have permission to write to this Item');
              }
            }

            const userRepository = queryRunner.manager.getRepository(User);
            
                  const user= await userRepository.findOne({ 
                    where: { email: userEmail } 
                  });
            
                  if(!user){
                    throw new Error('User Doest not Exist');
                  }

              
            return await permissionService.assignItemPermission(
                          user.id,existingItem.id
                        )
                  



    });
  }
