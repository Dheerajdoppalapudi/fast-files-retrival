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


export const listAllObjectService = async (userId: string, bucketName?: string): Promise<any> => {
  return executeTransaction(async (queryRunner) => {
    const itemRepository = queryRunner.manager.getRepository(MyItem);
    const permissionRepository = queryRunner.manager.getRepository(Permission);
    const bucketRepository = queryRunner.manager.getRepository(Bucket);

    let bucketFilter: { bucketId?: string } = {};

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
      order: { versions: { created_at: 'DESC' } }, // Sort versions by latest first
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
    const uniqueItems = new Map<string, MyItem>();
    [...ownedItems, ...accessItems].forEach((item) => {
      if (item) uniqueItems.set(item.id, item);
    });

    // Remove userId before returning
    return Array.from(uniqueItems.values()).map(({ userId, ...item }) => item);
  });
};


export const uploadObjectService = async (
  bucketId: string,
  key: string,
  file: Express.Multer.File,
  userId: string,
  notes?:string,
  parentId?: string,
): Promise<{ key: string; versionId: string; etag: string; status: string }> => {
  return executeTransaction(async (queryRunner) => {
    const bucketRepository = queryRunner.manager.getRepository(Bucket);
    const myItemRepository = queryRunner.manager.getRepository(MyItem);
    const versionRepository = queryRunner.manager.getRepository(ObjectVersion);
    const approverRepository = queryRunner.manager.getRepository(Approver);
    const approvalRepository = queryRunner.manager.getRepository(Approval);
    const userRepository = queryRunner.manager.getRepository(User);

    // Get the bucket
    const bucket = await bucketRepository.findOne({ where: { id: bucketId, parentId } });
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
      isFirstUpload=true;
      myItem = new MyItem();
      myItem.bucketId = bucket.id;
      myItem.key = key;
      myItem.userId = userId;
      myItem.versioningEnabled = true; // Enable versioning by default
      myItem.ownerAutoApproves=bucket.ownerAutoApproves
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
        ownerApprover.name = `file_${myItem.id}`;
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
    newVersion.notes=notes
    
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
          if (isFirstUpload ||  (shouldOwnerAutoApprove(bucket, myItem) && myItem.userId === userId)) {
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

    if(!myItem.versioningEnabled){
        const versions = await versionRepository.find({ where: { objectId: myItem.id } });
        // Delete all version files
        for (const version of versions) {
          if(version.id!==newVersion.id){
            const objectPath = getObjectPath(bucket.name, myItem.key, version.id);
            deleteFile(objectPath);
            await versionRepository.delete(version.id);
          }
        }
        newVersion.isLatest=true;
        await versionRepository.save(newVersion)
        // Delete the item and all its versions from database
    }

    // Save the file to the final location
    const objectPath = getObjectPath(bucket.name, key, newVersion.id);
    fs.renameSync(file.path, objectPath);



    return { 
      key, 
       
      etag, 
      status: newVersion.status ,
      versionId:newVersion.id
    };
  });
};

// Helper function to determine if owner should auto-approve
function shouldOwnerAutoApprove(bucket: Bucket, item: MyItem): boolean {
  // Check both bucket and item settings
    
  return item.ownerAutoApproves===true|| bucket.ownerAutoApproves === true;
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
      where: { objectId: myItem.id, id:versionId, status: 'approved' } 
    });
    if (!version) throw new Error('Version not found or not approved');
  } else {
    version = await versionRepository.findOne({ 
      where: { objectId: myItem.id, isLatest: true, status: 'approved' } 
    });
    if (!version) throw new Error('No approved version found');
  }

  if (version.deleteMarker) throw new Error('Object deleted');

  const objectPath = getObjectPath(bucketName, key, version.id);
  if (!fs.existsSync(objectPath)) throw new Error('Object data not found');

  return { filePath: objectPath, version };
};

export const deleteObjectService = async (
  ItemId: string, 
  userId: string, 
  versionId?: string
): Promise<{ message: string }> => {
  return executeTransaction(async (queryRunner) => {
    const bucketRepository = queryRunner.manager.getRepository(Bucket);
    const myItemRepository = queryRunner.manager.getRepository(MyItem);
    const versionRepository = queryRunner.manager.getRepository(ObjectVersion);

    const myItem = await myItemRepository.findOne({ where: { id:ItemId } });
    if (!myItem) throw new Error('Item not found');

    const myBucket = await bucketRepository.findOne({ where: { id:myItem.bucketId } });
    if (!myBucket) throw new Error('Bucket not found');



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
        where: { objectId: myItem.id, id:versionId }
      });
      
      if (!version) throw new Error('Version not found');
      
      // Delete the file
      const objectPath = getObjectPath(myBucket.name, myItem.key, version.id);
      
      // If this is the latest version, create a delete marker
      if (version.isLatest && myItem.versioningEnabled) {
        // Create a delete marker
        throw new Error("You can not delete the latest version . else Delete the file")
       
       
      } else {
        // Just delete the version
        await versionRepository.delete(version.id);
        deleteFile(objectPath);
        return { message: 'Version deleted successfully' };
      }
    } else {
      // Delete all versions if versioning is disabled or if explicitly requested
      const versions = await versionRepository.find({ where: { objectId: myItem.id } });
      
      // Delete all version files
      for (const version of versions) {
        const objectPath = getObjectPath(myBucket.name, myItem.key, version.id);
        deleteFile(objectPath);
      }
      // Delete the item and all its versions from database
      await myItemRepository.delete(myItem.id);
      
      return { message: 'Item and all versions deleted successfully' };
    }
  });
};


export const assignPermissionToItem =async(userId: any, itemID:any,
  userEmail:string,permissionType: string): Promise<Permission> => {
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
                          user.id,existingItem.id,permissionType.toLowerCase()
                        )
                  



    });
  }

  export const revokePermissionFromItem = async (
    userId: any,
    itemID: any,
    userEmail: string
  ): Promise<void> => {
    return executeTransaction(async (queryRunner) => {
      const myItemRepository = queryRunner.manager.getRepository(MyItem);
      const existingItem = await myItemRepository.findOne({
        where: { id: itemID },
      });
  
      if (!existingItem) throw new Error("Item is not Created Yet");
  
      if (existingItem.userId !== userId) {
        const hasWritePermission = await permissionService.hasItemPermission(
          userId,
          existingItem.id,
          "write"
        );

        if (!hasWritePermission) {
          throw new Error("You do not have permission to modify this Item");
        }
      }
      const userRepository = queryRunner.manager.getRepository(User);
  
      const user = await userRepository.findOne({
        where: { email: userEmail },
      });

  
      if (!user) {
        throw new Error("User does not exist");
      }

      if(existingItem.userId===user.id){
        throw new Error("You can not remove the acess of Owner");
      }
  
    
  
      await permissionService.revokeItemPermission(user.id, existingItem.id);
    });
  };
  
  export const getUserAccessListForItem = async (userId: any, itemID: any) :Promise<any>  => {
    return executeTransaction(async (queryRunner) => {
      const myItemRepository = queryRunner.manager.getRepository(MyItem);
      const existingItem = await myItemRepository.findOne({
        where: { id: itemID },
      });
  
      if (!existingItem) throw new Error("Item is not created yet");
  
      if (existingItem.userId !== userId) {
        const hasReadPermission = await permissionService.hasItemPermission(
          userId,
          existingItem.id,
          "write"
        );
        if (!hasReadPermission) {
          throw new Error("You do not have permission to view this item’s access list");
        }
      }
  
      const itemPermissions = await permissionService.getItemPermissions(existingItem.id);
      
      
      return itemPermissions.map((it)=>({
        username:it.user.username,
        email:it.user.email,
        permissionType:it.permissionType
        
        
      }))
    });
  };
  