import { Approval } from '../models/Approval';
import { Approver } from '../models/Approver';
import { Bucket } from '../models/Bucket';
import { MyItem } from '../models/Myitem';
import { User } from '../models/userModel';
import { executeTransaction } from '../utils/transactionUtils';

export const getBucketSettingService = async (
  userId: string,
  bucketId: string,
): Promise<any> => {
  return executeTransaction(async (queryRunner) => {
    const itemRepository = queryRunner.manager.getRepository(MyItem);
    const approverRepository = queryRunner.manager.getRepository(Approver);
    const bucketRepository = queryRunner.manager.getRepository(Bucket);
    const userRepository = queryRunner.manager.getRepository(User);

    // Find the bucket with its settings
    const bucket = await bucketRepository.findOne({
      where: { id: bucketId },
      relations: ['defaultApprover']
    });

    if (!bucket) {
      throw new Error('Bucket not found');
    }

    // Check if user is the owner of the bucket
    const isOwner = bucket.userId === userId;

    // Get all approvers for this bucket using the naming pattern
    const bucketApprovers = await approverRepository
      .createQueryBuilder("approver")
      .where("approver.name LIKE :namePattern", { namePattern: `bucket_${bucketId}%` })
      .getMany();

    const approverIds = bucketApprovers.map(a => a.id);

    // Check if user is in any of the approver groups for this bucket
    const isApprover = approverIds.length > 0 && Boolean(
      await queryRunner.manager
      .createQueryBuilder()
      .select("COUNT(1)")
      .from(Approver, "a")
      .innerJoin("approver_users", "au", "a.id = au.approverId")
      .where("au.userId = :userId", { userId })
      .andWhere("a.id IN (:...approverIds)", { approverIds})
      .getRawOne()
    );

    

    // Only allow access if user is owner or an approver
    if (!isOwner && !isApprover) {
      throw new Error('Unauthorized: You do not have permission to view these settings');
    }

    // Get the list of approvers for this bucket
    const approvals = await queryRunner.manager
      .createQueryBuilder(Approval, "approval")
      .leftJoinAndSelect("approval.approver", "approver")
      .where("approval.bucketId = :bucketId", { bucketId })
      .getMany();

    // For each approver, get the associated users
    const approverDetails = await Promise.all(
      bucketApprovers.map(async (approver) => {
        const approverUsers = await queryRunner.manager
          .createQueryBuilder()
          .select("user")
          .from(User, "user")
          .innerJoin("approver_users", "au", "user.id = au.userId")
          .where("au.approverId = :approverId", { approverId: approver.id })
          .getMany();

        // Map all users associated with this approver
        const approverUsersInfo = approverUsers.map(user => ({
          username: user.username || 'Unknown',
          email: user.email || 'Unknown',
        }));

        return {
          approverId: approver.id,
          approverName: approver.name,
          isGroup: approver.isGroup,
          isDefault: bucket.defaultApproverId === approver.id,
          users: approverUsersInfo, // List all users associated with this approver
        };
      })
    );

    // Get bucket items count
    const itemsCount = await itemRepository.count({
      where: { bucketId }
    });

    return {
      settings: {
        id: bucket.id,
        name: bucket.name,
        requiresApproval: bucket.requiresApproval,
        ownerAutoApproves: bucket.ownerAutoApproves,
        defaultApprover: bucket.defaultApprover ? {
          id: bucket.defaultApprover.id,
          name: bucket.defaultApprover.name,
        } : null,
        isOwner,
        canManageApprovers: isOwner, // Only owners can manage approvers
        itemsCount,
      },
      approvers: approverDetails, // List of approvers and their users
    };
  });
};


export const ApprovalBucketSettingService = async (
  userId: string,
  bucketId: string,
  body: any
): Promise<any> => {
  return executeTransaction(async (queryRunner) => {
    const itemRepository = queryRunner.manager.getRepository(MyItem);
    const approverRepository = queryRunner.manager.getRepository(Approver);
    const bucketRepository = queryRunner.manager.getRepository(Bucket);
    const userRepository = queryRunner.manager.getRepository(User);

    // Find the bucket
    const bucket = await bucketRepository.findOne({
      where: { id: bucketId }
    });

    if (!bucket) {
      throw new Error('Bucket not found');
    }

    // Check if user is the owner of the bucket
    const isOwner = bucket.userId === userId;
    
    // Get all approvers for this bucket using the naming pattern
    const bucketApprovers = await approverRepository
      .createQueryBuilder("approver")
      .where("approver.name LIKE :namePattern", { namePattern: `bucket_${bucketId}%` })
      .getMany();
    
    const approverIds = bucketApprovers.map(a => a.id);
    
    // Check if user is in any of the approver groups for this bucket
    const isApprover = approverIds.length > 0 && Boolean(
      await queryRunner.manager
        .createQueryBuilder()
        .select("1")
        .from(Approver, "a")
        .innerJoin("approver_users", "au", "a.id = au.approverId")
        .where("au.userId = :userId", { userId })
        .andWhere("a.id IN (:...approverIds)", { approverIds })
        .getOne()
    );

    // Only allow changes if user is owner or an approver
    if (!isOwner && !isApprover) {
      throw new Error('Unauthorized: You do not have permission to modify approval settings');
    }

    // Process the request based on the action type
    switch (body.action) {
      case 'updateSettings':
        // Update approval settings
        bucket.requiresApproval = body.requiresApproval !== undefined ? body.requiresApproval : bucket.requiresApproval;
        bucket.ownerAutoApproves = body.ownerAutoApproves !== undefined ? body.ownerAutoApproves : bucket.ownerAutoApproves;
        
        await bucketRepository.save(bucket);
        return { message: 'Approval settings updated successfully' };

      case 'addApprover':
        // Only owner can add approvers
        if (!isOwner) {
          throw new Error('Unauthorized: Only bucket owners can add approvers');
        }

        // Find the user by email
        const userToAdd = await userRepository.findOne({
          where: { email: body.email }
        });

        if (!userToAdd) {
          throw new Error('User not found');
        }

        // Use the bucket_{bucketId} naming format for approvers
        const approverName = `bucket_${bucketId}`;

        // Find or create the approver
        let approver = await approverRepository.findOne({
          where: { name: approverName },
          relations: ['users']
        });

        if (!approver) {
          // Create a new approver
          approver = approverRepository.create({
            name: approverName,
            isGroup: false,
            approvalType: 'standard',
            minApprovals: 1,
            users: [userToAdd]
          });
        } else {
          // Add the user to the approver if not already present
          if (!approver.users.some(u => u.id === userToAdd.id)) {
            approver.users.push(userToAdd);
          }
        }

        await approverRepository.save(approver);

        // Create an approval record to associate the approver with the bucket
        const existingApproval = await queryRunner.manager
          .createQueryBuilder()
          .select("approval")
          .from(Approval, "approval")
          .where("approval.bucketId = :bucketId", { bucketId })
          .andWhere("approval.approverId = :approverId", { approverId: approver.id })
          .getOne();

        if (!existingApproval) {
          const approval = new Approval();
          approval.bucketId = bucketId;
          approval.approverId = approver.id;
          approval.userId = userId; // Current user who is adding the approver
          approval.decision = 'pending'; // Initial state
          
          await queryRunner.manager.save(approval);
        }

        return { message: 'Approver added successfully' };

        case 'removeApprover':
          // Only owner can remove approvers
          if (!isOwner) {
            throw new Error('Unauthorized: Only bucket owners can remove approvers');
          }
        
          // Find the user by email
          const userToRemove = await userRepository.findOne({
            where: { email: body.email }
          });
        
          if (!userToRemove) {
            throw new Error('User not found');
          }
        
          // Find the approver associated with the bucket
          const approverToRemove = await approverRepository
            .createQueryBuilder("approver")
            .innerJoin("approver_users", "au", "approver.id = au.approverId")
            .where("au.userId = :userId", { userId: userToRemove.id })
            .andWhere("approver.name LIKE :namePattern", { namePattern: `bucket_${bucketId}%` })
            .getOne();
        
          if (!approverToRemove) {
            throw new Error('User is not an approver');
          }
        
        ;
        
          // Step 1: Remove the user from the approver_users table (disassociate the user from this approver)
          await queryRunner.manager
            .createQueryBuilder()
            .delete()
            .from("approver_users")
            .where("approverId = :approverId", { approverId: approverToRemove.id })
            .andWhere("userId = :userId", { userId: userToRemove.id })
            .execute();
        

        
          return { message: 'Approver removed successfully' };
        

      case 'setDefaultApprover':
        // Find the user by email
        const userToSetDefault = await userRepository.findOne({
          where: { email: body.email }
        });

        if (!userToSetDefault) {
          throw new Error('User not found');
        }

        // Find approver with the bucket_{bucketId} naming format
        const approverToSetDefault = await approverRepository
          .createQueryBuilder("approver")
          .innerJoin("approver_users", "au", "approver.id = au.approverId")
          .where("au.userId = :userId", { userId: userToSetDefault.id })
          .andWhere("approver.name LIKE :namePattern", { namePattern: `bucket_${bucketId}%` })
          .getOne();

        if (!approverToSetDefault) {
          throw new Error('User is not an approver');
        }

        // Set as default approver
        bucket.defaultApproverId = approverToSetDefault.id;
        await bucketRepository.save(bucket);
        return { message: 'Default approver set successfully' };

      default:
        throw new Error('Invalid action');
    }
  });
};

/**
 * Service to manage approval settings for a MyItem
 */
export const ApprovalItemSettingService = async (
  userId: string,
  itemId: string,
  body: any
): Promise<any> => {
  return executeTransaction(async (queryRunner) => {
    const itemRepository = queryRunner.manager.getRepository(MyItem);
    const approverRepository = queryRunner.manager.getRepository(Approver);
    const userRepository = queryRunner.manager.getRepository(User);

    // Find the item
    const item = await itemRepository.findOne({
      where: { id: itemId }
    });

    if (!item) {
      throw new Error('Item not found');
    }

    // Check if user is the owner of the item
    const isOwner = item.userId === userId;
    
    // Get all approvers for this item using the naming pattern
    const itemApprovers = await approverRepository
      .createQueryBuilder("approver")
      .where("approver.name LIKE :namePattern", { namePattern: `file_${itemId}%` })
      .getMany();

      console.log(itemApprovers)
    
    const approverIds = itemApprovers.map(a => a.id);
    
    // Check if user is in any of the approver groups for this item
    const isApprover = approverIds.length > 0 && Boolean(
      await queryRunner.manager
        .createQueryBuilder()
        .select("1")
        .from(Approver, "a")
        .innerJoin("approver_users", "au", "a.id = au.approverId")
        .where("au.userId = :userId", { userId })
        .andWhere("a.id IN (:...approverIds)", { approverIds })
        .getOne()
    );

    // Only allow changes if user is owner or an approver
    if (!isOwner && !isApprover) {
      throw new Error('Unauthorized: You do not have permission to modify approval settings');
    }

    // Process the request based on the action type
    switch (body.action) {
      case 'updateSettings':
        // Update approval settings
        item.requiresApproval = body.requiresApproval !== undefined ? body.requiresApproval : item.requiresApproval;
        item.versioningEnabled=body.versioningEnabled !== undefined ? body.versioningEnabled : item.versioningEnabled;
        item.ownerAutoApproves=body.ownerAutoApproves!==undefined?body.ownerAutoApproves:item.ownerAutoApproves;
        await itemRepository.save(item);
        return { message: 'Approval settings updated successfully' };

      case 'addApprover':
        // Only owner can add approvers
        if (!isOwner) {
          throw new Error('Unauthorized: Only item owners can add approvers');
        }

        // Find the user by email
        const userToAdd = await userRepository.findOne({
          where: { email: body.email }
        });

        if (!userToAdd) {
          throw new Error('User not found');
        }

        // Use the file_{itemId} naming format for approvers
        const approverName = `file_${itemId}`;

        // Find or create the approver
        let approver = await approverRepository.findOne({
          where: { name: approverName },
          relations: ['users']
        });

        
        if (!approver) {
          // Create a new approver
          approver = approverRepository.create({
            name: approverName,
            isGroup: false,
            approvalType: 'standard',
            minApprovals: 1,
            users: [userToAdd]
          });
        } else {
          // Add the user to the approver if not already present
          if (!approver.users.some(u => u.id === userToAdd.id)) {
            approver.users.push(userToAdd);
          }
        }

        await approverRepository.save(approver);

        // Create an approval record to associate the approver with the item
      // Create an approval record to associate the approver with the item
      const existingApproval = await queryRunner.manager
      .createQueryBuilder()
      .select("approval")
      .from(Approval, "approval")
      .where("approval.itemId = :itemId", { itemId })
      .andWhere("approval.approverId = :approverId", { approverId: approver.id })
      .getOne();

    if (!existingApproval) {
      const approval = new Approval();
      approval.itemId = itemId;
      approval.approverId = approver.id;
      approval.userId = userId; // Current user who is adding the approver
      approval.decision = 'pending'; // Initial state
      
      await queryRunner.manager.save(approval);
    }

    return { message: 'Approver added successfully' };

  case 'removeApprover':
    // Only owner can remove approvers
    if (!isOwner) {
      throw new Error('Unauthorized: Only item owners can remove approvers');
    }

    // Find the user by email
    const userToRemove = await userRepository.findOne({
      where: { email: body.email }
    });

    if (!userToRemove) {
      throw new Error('User not found');
    }

    // Find approver with the file_{itemId} naming format
    const approverToRemove = await approverRepository
      .createQueryBuilder("approver")
      .innerJoin("approver_users", "au", "approver.id = au.approverId")
      .where("au.userId = :userId", { userId: userToRemove.id })
      .andWhere("approver.name LIKE :namePattern", { namePattern: `file_${itemId}%` })
      .getOne();

    if (!approverToRemove) {
      throw new Error('User is not an approver');
    }
    // Remove the approval record
        await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from("approver_users")
        .where("approverId = :approverId", { approverId: approverToRemove.id })
        .andWhere("userId = :userId", { userId: userToRemove.id })
        .execute();


    return { message: 'Approver removed successfully' };

  case 'setDefaultApprover':
    // Find the user by email
    const userToSetDefault = await userRepository.findOne({
      where: { email: body.email }
    });

    if (!userToSetDefault) {
      throw new Error('User not found');
    }

    // Find approver with the file_{itemId} naming format
    const approverToSetDefault = await approverRepository
      .createQueryBuilder("approver")
      .innerJoin("approver_users", "au", "approver.id = au.approverId")
      .where("au.userId = :userId", { userId: userToSetDefault.id })
      .andWhere("approver.name LIKE :namePattern", { namePattern: `file_${itemId}%` })
      .getOne();

    if (!approverToSetDefault) {
      throw new Error('User is not an approver');
    }

    // Set as default approver
    item.defaultApproverId = approverToSetDefault.id;
    await itemRepository.save(item);
    return { message: 'Default approver set successfully' };

  default:
    throw new Error('Invalid action');
}
});
};

/**
* Service to get approval settings for a MyItem
*/
export const getItemSettingService = async (
  userId: string,
  itemId: string,
): Promise<any> => {
  return executeTransaction(async (queryRunner) => {
    const itemRepository = queryRunner.manager.getRepository(MyItem);
    const approverRepository = queryRunner.manager.getRepository(Approver);
    const userRepository = queryRunner.manager.getRepository(User);

    // Find the item with its settings
    const item = await itemRepository.findOne({
      where: { id: itemId },
      relations: ['defaultApprover', 'bucket']
    });

    if (!item) {
      throw new Error('Item not found');
    }

    // Check if user is the owner of the item
    const isOwner = item.userId === userId;

    // Get all approvers for this item using the naming pattern
    const itemApprovers = await approverRepository
      .createQueryBuilder("approver")
      .where("approver.name LIKE :namePattern", { namePattern: `file_${itemId}%` })
      .getMany();

    const itemApproverIds = itemApprovers.map(a => a.id);

    // Check if user is in any of the approver groups for this item
    const isItemApprover = itemApproverIds.length > 0 && Boolean(
      await queryRunner.manager
        .createQueryBuilder()
        .select("COUNT(1)")
        .from(Approver, "a")
        .innerJoin("approver_users", "au", "a.id = au.approverId")
        .where("au.userId = :userId", { userId })
        .andWhere("a.id IN (:...approverIds)", { approverIds: itemApproverIds })
        .getRawOne()
    );


    // Get all bucket approvers if the item belongs to a bucket
    let isBucketApprover = false;
    if (item.bucketId) {
      const bucketApprovers = await approverRepository
        .createQueryBuilder("approver")
        .where("approver.name LIKE :namePattern", { namePattern: `bucket_${item.bucketId}%` })
        .getMany();

      const bucketApproverIds = bucketApprovers.map(a => a.id);

      // Check if user is in any of the approver groups for the parent bucket
      isBucketApprover = bucketApproverIds.length > 0 && Boolean(
      
        await queryRunner.manager
        .createQueryBuilder()
        .select("COUNT(1)")
        .from(Approver, "a")
        .innerJoin("approver_users", "au", "a.id = au.approverId")
        .where("au.userId = :userId", { userId })
        .andWhere("a.id IN (:...approverIds)", { approverIds: bucketApproverIds})
        .getRawOne()
      );
     
    }

    // Only allow access if user is owner or an approver (for either item or parent bucket)
    if (!isOwner && !isItemApprover && !isBucketApprover) {
      throw new Error('Unauthorized: You do not have permission to view these settings');
    }

    // For each approver, get the associated users
    const approverDetails = await Promise.all(
      itemApprovers.map(async (approver) => {
        const approverUsers = await queryRunner.manager
          .createQueryBuilder()
          .select("user")
          .from(User, "user")
          .innerJoin("approver_users", "au", "user.id = au.userId")
          .where("au.approverId = :approverId", { approverId: approver.id })
          .getMany();

        // Map the users to include their username and email
        const approverUsersInfo = approverUsers.map(user => ({
          username: user.username || 'Unknown',
          email: user.email || 'Unknown',
        }));

        return {
          approverId: approver.id,
          approverName: approver.name,
          isGroup: approver.isGroup,
          isDefault: item.defaultApproverId === approver.id,
          users: approverUsersInfo, // List all users associated with this approver
        };
      })
    );

    // Get approval history for this item (for all versions)
    const versionApprovals = await queryRunner.manager
      .createQueryBuilder(Approval, "approval")
      .leftJoinAndSelect("approval.objectVersion", "version")
      .leftJoinAndSelect("approval.user", "user")
      .where(
        "(approval.itemId = :itemId OR approval.objectVersionId IN " +
        "(SELECT id FROM object_versions WHERE objectId = :itemId))",
        { itemId }
      )
      .orderBy("approval.created_at", "DESC")
      .getMany();

    const approvalHistory = versionApprovals.map(approval => ({
      id: approval.id,
      version: approval.objectVersion ? approval.objectVersion.id : null,
      username: approval.user ? approval.user.username : 'Unknown',
      decision: approval.decision,
      comments: approval.comments,
      date: approval.created_at
    }));

    return {
      settings: {
        id: item.id,
        name: item.key,
        bucketId: item.bucketId,
        bucketName: item.bucket ? item.bucket.name : null,
        requiresApproval: item.requiresApproval,
        versioningEnabled: item.versioningEnabled,
        approvalStatus: item.approvalStatus,
        ownerAutoApproves:item.ownerAutoApproves,
        defaultApprover: item.defaultApprover ? {
          id: item.defaultApprover.id,
          name: item.defaultApprover.name,
        } : null,
        isOwner,
        canManageApprovers: isOwner, // Only owners can manage approvers
      },
      approvers: approverDetails, // List of approvers and their users
      approvalHistory
    };
  });
};
