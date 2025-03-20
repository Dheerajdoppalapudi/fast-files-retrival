import { executeTransaction } from '../utils/transactionUtils';
import { PermissionService } from './PermissionService';
import { getObjectPath, deleteFile } from '../utils/storage';
import { ObjectVersion } from '../models/ObjectVersion';
import { AppDataSource } from '../config/db';
import { Bucket } from '../models/Bucket';
import { MyItem } from '../models/Myitem';
import { Approval } from '../models/Approval';
import { In, IsNull } from 'typeorm';
import { Approver } from '../models/Approver';

const permissionService = new PermissionService();

export const approveVersionService = async (
  versionId: string, 
  userId: any
): Promise<{ message: string; version: ObjectVersion }> => {
  return executeTransaction(async (queryRunner) => {
    const versionRepository = queryRunner.manager.getRepository(ObjectVersion);

    const version = await versionRepository.findOne({ where: { id:versionId } });
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

    const userApproverGroups = await queryRunner.manager.getRepository(Approver)
    .createQueryBuilder("approver")
    .innerJoin("approver.users", "user", "user.id = :userId", { userId })
    .andWhere("approver.name LIKE :namePattern", { namePattern: `file_${myItem.id}%` })
    .getMany();


      const userApproverIds = userApproverGroups.map((group) => group.id);
      const approvalRepository=await queryRunner.manager.getRepository(Approval);

      const pendingApproval =  await approvalRepository.findOne({
                        where: [
                          // Case 1: Direct user approval (unanimous approval case)
                          {
                            objectVersionId: version.id,
                            approverId: In(userApproverIds),
                            decision: "pending",
                          },
                          // Case 2: Group approval with no specific user assigned yet (standard approval case)
                          {
                            objectVersionId: version.id,
                            approverId: In(userApproverIds),
                            decision: "pending",
                          },
                        ],
                      })

    
      if (!pendingApproval) {
        throw new Error('You do not have permission to approve this version');
      }
      pendingApproval.decision="approved"
      pendingApproval.comments="Approved By UserID"
      const savedVersion = await approvalRepository.save(pendingApproval);
  
      
  

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
    userId: any
  ): Promise<{ message: string; version: ObjectVersion }> => {
    return executeTransaction(async (queryRunner) => {
      const versionRepository = queryRunner.manager.getRepository(ObjectVersion);
  
      const version = await versionRepository.findOne({ where: { id:versionId } });
      if (!version) throw new Error('Version not found');
  
      // Get the item associated with the version
      const myItem = await queryRunner.manager.getRepository(MyItem).findOne({ 
        where: { id: version.objectId } 
      });
      if (!myItem) throw new Error('Item not found');

      if (version.status === 'rejected') {
        return { message: 'Version already rejected', version };
      }
      
      const userApproverGroups = await queryRunner.manager.getRepository(Approver)
      .createQueryBuilder("approver")
      .innerJoin("approver.users", "user", "user.id = :userId", { userId })
      .getMany();
  
      const userApproverIds = userApproverGroups.map((group) => group.id);
     
    
      const approvalRepository=await queryRunner.manager.getRepository(Approval);
      const pendingApproval =  await approvalRepository.findOne({
                        where: [
                          // Case 1: Direct user approval (unanimous approval case)
                          {
                            objectVersionId: version.id,
                            approverId: In(userApproverIds),
                           
                            decision: "pending",
                          },
                          // Case 2: Group approval with no specific user assigned yet (standard approval case)
                          {
                            objectVersionId: version.id,
                            approverId: In(userApproverIds),
                           
                            decision: "pending",
                          },
                        ],
                      })

                      console.log(pendingApproval,version,userId)
      if (!pendingApproval) {
        throw new Error('You do not have permission to reject this version');
      }
      pendingApproval.decision="rejected"
      pendingApproval.comments="rejected By UserID"
      const savedVersion = await approvalRepository.save(pendingApproval);
      
  
      // Get the bucket associated with the item
      const bucket = await queryRunner.manager.getRepository(Bucket).findOne({ 
        where: { id: myItem.bucketId } 
      });
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
  