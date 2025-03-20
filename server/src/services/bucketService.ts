import { IsNull, Raw } from "typeorm";
import { AppDataSource } from "../config/db";
import { Bucket } from "../models/Bucket";
import { MyItem } from "../models/Myitem";
import { Permission } from "../models/Permission";
import { User } from "../models/userModel";
import { executeTransaction } from "../utils/transactionUtils";
import { PermissionService } from "./PermissionService";
import { In } from "typeorm";
import { ObjectVersion } from "../models/ObjectVersion";
import { Approver } from "../models/Approver";
import { Approval } from "../models/Approval";

const permissionService = new PermissionService();


export const listBucketContentsService = async (
  userId: string,
  bucketId?: string
): Promise<any> => {
  return executeTransaction(async (queryRunner) => {
    const repositories = {
      bucket: queryRunner.manager.getRepository(Bucket),
      item: queryRunner.manager.getRepository(MyItem),
      permission: queryRunner.manager.getRepository(Permission),
      approver: queryRunner.manager.getRepository(Approver),
      approval: queryRunner.manager.getRepository(Approval),
      version: queryRunner.manager.getRepository(ObjectVersion)
    };

    // Get user permissions and build maps
    const userPermissions = await repositories.permission
      .createQueryBuilder("permission")
      .leftJoinAndSelect("permission.bucket", "bucket")
      .where("permission.userId = :userId", { userId })
      .getMany();

    const directAccessBucketIds = new Set<string>();
    const bucketPermissionMap = new Map<string, string>();
    userPermissions.forEach(perm => {
      if (perm.bucket) {
        directAccessBucketIds.add(perm.bucket.id);
        bucketPermissionMap.set(perm.bucket.id, perm.permissionType);
      }
    });

    // Get approver info
    const userApproverGroups = await repositories.approver
      .createQueryBuilder("approver")
      .innerJoin("approver.users", "user", "user.id = :userId", { userId })
      .getMany();

    const userApproverIds = userApproverGroups.map(group => group.id);
    const isApprover = userApproverIds.length > 0;

    // Build approver map
    const approverMap = new Map<string, string[]>();
    if (isApprover) {
      userApproverGroups.forEach(approver => {
        const name = approver.name;
        let id, prefix;
        
        if (name.startsWith('bucket_')) {
          prefix = 'bucket_';
          id = name.substring(7);
        } else if (name.startsWith('file_')) {
          prefix = 'file_';
          id = name.substring(5);
        } else {
          return;
        }
        
        if (!approverMap.has(id)) {
          approverMap.set(id, []);
        }
        approverMap.get(id)?.push(name);
      });
    }

    // Handle locations and folders
    let folders = [];
    let currentLocation: { id?: string; name: string; parentId?: string | null } = { name: "Root" };

    if (bucketId === undefined) {
      // Root level - get all accessible folders
      const accessibleFolders = await repositories.bucket.find({
        where: { id: In(Array.from(directAccessBucketIds)) },
        relations: ["parent"],
      });

      folders = accessibleFolders.filter(folder => 
        folder.parentId === null || (folder.parentId !== undefined && !directAccessBucketIds.has(folder.parentId))
      );
    } else {
      // Specific folder - get current folder and subfolders
      const currentBucket = await repositories.bucket.findOne({
        where: { id: bucketId },
        relations: ["parent"],
      });

      if (!currentBucket) {
        return { currentLocation: { name: "Root" }, folders: [], files: [] };
      }

      currentLocation = {
        id: currentBucket.id,
        name: currentBucket.name,
        parentId: currentBucket.parentId,
      };

      if (directAccessBucketIds.has(bucketId)) {
        folders = await repositories.bucket.find({ where: { parentId: bucketId } });
      } else {
        return { currentLocation, folders: [], files: [] };
      }
    }

    // Handle files
    let files: any[] = [];
    if (bucketId !== undefined) {
      // Get files user has access to
      const [permittedFilesPermissions, ownedFiles] = await Promise.all([
        repositories.permission
          .createQueryBuilder("permission")
          .leftJoinAndSelect("permission.item", "item")
          .where("permission.userId = :userId", { userId })
          .andWhere("permission.itemId IS NOT NULL")
          .andWhere("item.bucketId = :bucketId", { bucketId })
          .getMany(),
        
        repositories.item.find({ where: { bucketId, userId } })
      ]);

      const accessibleFileIds = [
        ...new Set([
          ...permittedFilesPermissions.map(perm => perm.item?.id).filter(Boolean),
          ...ownedFiles.map(file => file.id)
        ])
      ];

      if (accessibleFileIds.length > 0) {
        // Get file details, versions and approvals in parallel
        const allVersions = await repositories.version
          .createQueryBuilder("version")
          .leftJoinAndSelect("version.uploader", "uploader")
          .where("version.objectId IN (:...fileIds)", { fileIds: accessibleFileIds })
          .orderBy("version.created_at", "DESC")
          .getMany();

        const [allAccessibleFiles, pendingApprovals] = await Promise.all([
          repositories.item.find({
            where: { id: In(accessibleFileIds) },
            relations: ['owner', 'permissions'],
          }),
          
          isApprover ? repositories.approval.find({
            where: [
              {
                objectVersionId: In(allVersions.map(v => v.id)),
                approverId: In(userApproverIds),
                userId: userId,
                decision: "pending",
              },
              {
                objectVersionId: In(allVersions.map(v => v.id)),
                approverId: In(userApproverIds),
                userId: IsNull(),
                decision: "pending",
              },
            ],
          }) : []
        ]);

        // Index versions and approvals for quick access
        const versionsByFileId = allVersions.reduce((acc: { [key: string]: ObjectVersion[] }, version) => {
          if (!acc[version.objectId]) acc[version.objectId] = [];
          acc[version.objectId].push(version);
          return acc;
        }, {});

        const approvalsByVersionId = pendingApprovals.reduce<{ [key: string]: Approval }>((acc, approval) => {
          if (approval.objectVersionId) acc[approval.objectVersionId] = approval;
          return acc;
        }, {});

        // Process files
        files = allAccessibleFiles
          .map(file => {
            const fileVersions = versionsByFileId[file.id] || [];
            
            const filteredVersions = fileVersions
              .map((version: any) => {
                if (version.status === "approved" || 
                    version.userId === userId ||
                    (isApprover && version.status !== "rejected" && approvalsByVersionId[version.id])) {
                  return {
                    ...version,
                    uploader: version.uploader ? version.uploader.username : "Unknown User",
                    ...(approvalsByVersionId[version.id] ? { requestingApproval: true } : {})
                  };
                }
                return null;
              })
              .filter(Boolean);

            if (filteredVersions.length === 0) return null;

            const latestVersion = filteredVersions.find(it => it.isLatest) || null;
            const fileApprovers = approverMap.get(file.id) || [];
            const isOwner=file.userId===userId;
            const result = {
              id: file.id,
              name: file.key,
              type: "file",
              bucketId: file.bucketId,
              userId: file.userId,
              created_at: file.created_at,
              updated_at: file.updated_at,
              owner: {
                username: file.owner.username,
                email: file.owner.email,
              },
              permissionType: file.permissions.find(
                perm => perm.itemId === file.id && perm.userId === userId
              )?.permissionType || null,
              latestVersion: latestVersion && { ...latestVersion, name: file.key },
              versions: filteredVersions,
              ...(fileApprovers.length > 0 ? {
                isApprover: true,
                approverNames: fileApprovers
              } : {}),
              ...(isOwner?{
                isOwner:isOwner
              }:{})
            };
            
            return result;
          })
          .filter(Boolean);
      }
    }

    // Format folders with permissions
    const folderIds = folders.map(folder => folder.id);
    const missingFolderIds = folderIds.filter(id => !bucketPermissionMap.has(id));
    
    if (missingFolderIds.length > 0) {
      const additionalPermissions = await repositories.permission.find({
        where: {
          bucketId: In(missingFolderIds),
          userId: userId
        }
      });
      
      additionalPermissions.forEach(perm => {
        if (perm.bucketId) {
          bucketPermissionMap.set(perm.bucketId, perm.permissionType);
        }
      });
    }
    
    const folderList = folders.map(folder => {
      let permissionType = bucketPermissionMap.get(folder.id) || 
                          (folder.userId === userId ? "owner" : null);
      
      const bucketApprovers = approverMap.get(folder.id) || [];
      const isOwner=folder.userId===userId;
      
      
      return {
        id: folder.id,
        name: folder.name,
        type: "folder",
        parentId: folder.parentId,
        modified: folder.updated_at,
        permissionType,
        ...(bucketApprovers.length > 0 ? {
          isApprover: true,
          approverNames: bucketApprovers
        } : {}),
        ...(isOwner?{
          isOwner:isOwner
        }:{})
      };
    });

    return {
      currentLocation,
      folders: folderList,
      files,
    };
  });
};
export const listFilesByExtensionService = async (
    userId: string,
    fileExtension?: string
  ): Promise<any> => {
    return executeTransaction(async (queryRunner) => {
      const bucketRepository = queryRunner.manager.getRepository(Bucket);
      const itemRepository = queryRunner.manager.getRepository(MyItem);
      const permissionRepository = queryRunner.manager.getRepository(Permission);
      const approverRepository = queryRunner.manager.getRepository(Approver);
      const approvalRepository = queryRunner.manager.getRepository(Approval);
  
      // Step 1: Get all buckets that the user has direct access to (with permission types in one query)
      const userPermissions = await permissionRepository
        .createQueryBuilder("permission")
        .leftJoinAndSelect("permission.bucket", "bucket")
        .where("permission.userId = :userId", { userId })
        .getMany();
  
      const approverMap = new Map<string, string[]>();
      // Extract bucket IDs and permission types in one pass
      const directAccessBucketIds = new Set<string>();
      const bucketPermissionMap = new Map<string, string>();
      
      userPermissions.forEach((perm) => {
        if (perm.bucket) {
          directAccessBucketIds.add(perm.bucket.id);
          bucketPermissionMap.set(perm.bucket.id, perm.permissionType);
        }
      });
  
      // Check if user is an approver in any approver groups
      const userApproverGroups = await approverRepository
        .createQueryBuilder("approver")
        .innerJoin("approver.users", "user", "user.id = :userId", { userId })
        .getMany();
  
      const userApproverIds = userApproverGroups.map((group) => group.id);
      const isApprover = userApproverIds.length > 0;
  
      // Step 2: Prepare for file filtering
      const accessibleBucketIds = Array.from(directAccessBucketIds);
  
      // Step 3: Optimize file retrieval with extension filtering
      // Build file extension filter condition if extension is provided
      let fileExtensionCondition = {};
      if (fileExtension) {
        fileExtensionCondition = {
          key: Raw(alias => `${alias} LIKE :extension`, { 
            extension: `%.${fileExtension.toLowerCase().replace(/^\./, '')}` 
          })
        };
      }

      if (isApprover) {

        for (const approver of userApproverGroups) {
          const approverName = approver.name;

        if (approverName.startsWith('file_')) {
          const itemId = approverName.substring(5); // Remove 'file_' prefix
          if (!approverMap.has(itemId)) {
            approverMap.set(itemId, []);
          }
          approverMap.get(itemId)?.push(approverName);
        }
      }

    }
  
      // Get files the user owns with the specified extension
      const ownedFiles = await itemRepository.find({
        where: {
          bucketId: In(accessibleBucketIds),
          userId,
          ...fileExtensionCondition
        }
      });

  
      // Get files the user has permissions for with the specified extension
      const permittedFilesPermissions = await permissionRepository
        .createQueryBuilder("permission")
        .leftJoinAndSelect("permission.item", "item")
        .where("permission.userId = :userId", { userId })
        .andWhere("permission.itemId IS NOT NULL")
        .andWhere("item.bucketId IN (:...bucketIds)", { bucketIds: accessibleBucketIds })
        .getMany();
  
      // Filter permitted files by extension if needed
      let filteredPermittedFilesPermissions = permittedFilesPermissions;
      if (fileExtension) {
        const ext = fileExtension.toLowerCase().replace(/^\./, '');
        filteredPermittedFilesPermissions = permittedFilesPermissions.filter(perm => 
          perm.item?.key?.toLowerCase().endsWith(`.${ext}`)
        );
      }
  
      const permittedFileIds = filteredPermittedFilesPermissions
        .map((perm) => perm.item?.id)
        .filter((id) => id !== undefined) as string[];
      
      const ownedFileIds = ownedFiles.map((file) => file.id);
  
      // Combine all accessible file IDs and remove duplicates
      const accessibleFileIds = [
        ...new Set([...permittedFileIds, ...ownedFileIds]),
      ];
  
      let files = [];
      if (accessibleFileIds.length > 0) {
        // Fetch all accessible files with owner and permissions in one query
        const allAccessibleFiles = await itemRepository.find({
          where: { id: In(accessibleFileIds) },
          relations: ['owner', 'permissions'],
        });
  
        // Batch fetch all versions for these files in one query
        const allVersions = await queryRunner.manager
          .getRepository(ObjectVersion)
          .createQueryBuilder("version")
          .leftJoinAndSelect("version.uploader", "uploader")
          .where("version.objectId IN (:...fileIds)", { fileIds: accessibleFileIds })
          .orderBy("version.created_at", "DESC")
          .getMany();
  
        // Group versions by file ID for faster access
        const versionsByFileId: { [key: string]: ObjectVersion[] } = {};
        allVersions.forEach(version => {
          if (!versionsByFileId[version.objectId]) {
            versionsByFileId[version.objectId] = [];
          }
          versionsByFileId[version.objectId].push(version);
        });
  
        // Batch fetch all pending approvals that might be relevant
        const pendingApprovals = isApprover ? await approvalRepository.find({
          where: [
            {
              objectVersionId: In(allVersions.map(v => v.id)),
              approverId: In(userApproverIds),
              userId: userId,
              decision: "pending",
            },
            {
              objectVersionId: In(allVersions.map(v => v.id)),
              approverId: In(userApproverIds),
              userId: IsNull(),
              decision: "pending",
            },
          ],
        }) : [];
  
        // Group approvals by version ID
        const approvalsByVersionId: { [key: string]: Approval } = {};
        pendingApprovals.forEach(approval => {
          if (approval.objectVersionId !== undefined) {
            approvalsByVersionId[approval.objectVersionId] = approval;
          }
        });
  
        // Process each file
        for (const file of allAccessibleFiles) {
          const fileVersions = versionsByFileId[file.id] || [];
          
          // Filter versions based on user's role and access - now with fewer DB calls
          const filteredVersions = fileVersions.map(version => {
            if (version.status === "approved") {
              return {
                ...version,
                uploader: version.uploader ? version.uploader.username : "Unknown User",
              };
            }
  
            if (version.userId === userId) {
              return {
                ...version,
                uploader: version.uploader ? version.uploader.username : "Unknown User",
              };
            }
  
            if (isApprover && version.status !== "rejected") {
              const pendingApproval = approvalsByVersionId[version.id];
              if (pendingApproval) {
                return {
                  ...version,
                  uploader: version.uploader ? version.uploader.username : "Unknown User",
                  requestingApproval: true,
                };
              }
            }
  
            return null;
          }).filter(v => v !== null);


  
          // Skip files with no accessible versions
          if (filteredVersions.length === 0) continue;
  
          const latestVersion = filteredVersions.find(it => it.isLatest) || null;
          const latestVersionWithKey = latestVersion && { ...latestVersion, name: file.key };
          const fileApprovers = approverMap.get(file.id) || [];
          const isOwner=file.userId===userId;
         
          files.push({
            id: file.id,
            name: file.key,
            type: "file",
            bucketId: file.bucketId,
            userId: file.userId,
            created_at: file.created_at,
            updated_at: file.updated_at,
            owner: {
              username: file.owner.username,
              email: file.owner.email,
            },
            permissionType: file.permissions.find(
              (perm) => perm.itemId === file.id && perm.userId === userId
            )?.permissionType || null,
            latestVersion: latestVersionWithKey,
            versions: filteredVersions,
            ...(fileApprovers.length > 0 ? {
              isApprover: true,
              approverNames: fileApprovers
            } : {}),
            ...(isOwner?{
              isOwner:isOwner
            }:{})
            
          });
        }
      }
  
      // Get bucket information for grouping files by location
      const fileBucketIds = [...new Set(files.map(file => file.bucketId))];
      const buckets = fileBucketIds.length > 0 ? await bucketRepository.find({
        where: { id: In(fileBucketIds) },
        relations: ["parent"],
      }) : [];
  
      const bucketIdToInfo: { [key: string]: { name: string; path: string; parentId: string | null } } = {};
      buckets.forEach(bucket => {
        bucketIdToInfo[bucket.id] = {
          name: bucket.name,
          path: bucket.name,
          parentId: bucket.parentId ?? null
        };
      });
  
      // Group files by bucket for better organization
      const filesByBucket: { [key: string]: { bucketInfo: { name: string; path: string; parentId: string | null }; files: any[] } } = {};
      files.forEach(file => {
        const bucketId = file.bucketId;
        if (!filesByBucket[bucketId]) {
          filesByBucket[bucketId] = {
            bucketInfo: bucketIdToInfo[bucketId] || { name: "Unknown", path: "Unknown" },
            files: []
          };
        }
        filesByBucket[bucketId].files.push(file);
      });
  
      return {
        extension: fileExtension || "all",
        totalFiles: files.length,
        folders:[],
        // filesByBucket: filesByBucket,
        files: files,
      };
    });
  };
export const listAllBucketService = async (userId: any): Promise<any> => {
  return executeTransaction(async (queryRunner) => {
    const bucketRepository = queryRunner.manager.getRepository(Bucket);
    const permissionRepository = queryRunner.manager.getRepository(Permission);

    // Fetch buckets owned by the user
    console.log(userId);
    const ownedBuckets = await bucketRepository.find({
      where: { userId },
      relations: ["children", "permissions"],
    });

    console.log(ownedBuckets.length);
    // Fetch buckets where the user has explicit permission
    const permittedBuckets = await permissionRepository
      .createQueryBuilder("permission")
      .leftJoinAndSelect("permission.bucket", "bucket")
      .where("permission.userId = :userId", { userId })
      .andWhere("permission.bucketId IS NOT NULL") // Ensure it's a bucket permission
      .getMany();

    console.log(permittedBuckets.length);
    // Extract unique buckets from permissions
    const accessBuckets = permittedBuckets
      .map((perm) => perm.bucket)
      .filter((b) => b !== null);

    // Combine both owned and accessible buckets
    const uniqueBuckets = new Map();
    [...ownedBuckets, ...accessBuckets].forEach((bucket) => {
      if (bucket) uniqueBuckets.set(bucket.id, bucket);
    });
    return Array.from(uniqueBuckets.values()).map(
      ({ userId, ...bucket }) => bucket
    );
  });
};

export const createBucketService = async (
  bucketName: string,
  userId: any,
  bucketParentId?: any
): Promise<Bucket> => {
  return executeTransaction(async (queryRunner) => {
    const bucketRepository = queryRunner.manager.getRepository(Bucket);
    const approvalRepository = queryRunner.manager.getRepository(Approval);
    const approverRepository = queryRunner.manager.getRepository(Approver);
    const whereCondition: any = { name: bucketName, userId };

    // Include parentId only if it's provided (not `null` or `undefined`)
    if (bucketParentId &&bucketParentId !== undefined) {
      whereCondition.parentId = bucketParentId;
    }
    const existingBucket = await bucketRepository.findOne({ where: whereCondition });
    if (existingBucket) throw new Error("Bucket already exists");

    const bucket = new Bucket();
    bucket.name = bucketName;
    bucket.userId = userId;
    bucket.parentId = bucketParentId;

    await bucketRepository.save(bucket);
    await permissionService.assignBucketPermission(userId, bucket.id);


    if (bucket.requiresApproval && !bucket.defaultApproverId){
      const ownerApprover = new Approver();
        ownerApprover.name = `bucket_${bucket.id}`;
        ownerApprover.isGroup = false;
        ownerApprover.approvalType = 'standard';
        ownerApprover.minApprovals = 1;
        const savedApprover = await approverRepository.save(ownerApprover);
        await queryRunner.manager.query(
          `INSERT INTO approver_users (approverId, userId) VALUES (?, ?)`,
          [savedApprover.id, userId]
        );
    }
    

    return bucket;
  });
};

export const assignBucketPermission = async (
  bucketId: any,
  userId: any,
  userEmail: string,
  permissionType: string 
): Promise<Permission> => {
  return executeTransaction(async (queryRunner) => {
    const bucketRepository = queryRunner.manager.getRepository(Bucket);
    const existingBucket = await bucketRepository.findOne({
      where: { id: bucketId },
    });

    if (!existingBucket) throw new Error("Bucket is not Created Yet");

    if (existingBucket.userId !== userId) {
      const hasWritePermission = await permissionService.hasBucketPermission(
        userId,
        existingBucket.id,
        "write"
      );
      if (!hasWritePermission) {
        throw new Error("You do not have permission to write to this bucket");
      }
    }

    const userRepository = queryRunner.manager.getRepository(User);

    const user = await userRepository.findOne({
      where: { email: userEmail },
    });

    if (!user) {
      throw new Error("User Doest not Exist");
    }

    return await permissionService.assignBucketPermission(
      user.id,
      existingBucket.id,permissionType.toLowerCase()
    );
  });
};

export const revokeBucketPermission = async (
  bucketId: any,
  userId: any,
  userEmail: string
): Promise<void> => {
  return executeTransaction(async (queryRunner) => {
    const bucketRepository = queryRunner.manager.getRepository(Bucket);
    const existingBucket = await bucketRepository.findOne({
      where: { id: bucketId },
    });

    if (!existingBucket) throw new Error("Bucket is not Created Yet");

    if (existingBucket.userId !== userId) {
      const hasWritePermission = await permissionService.hasBucketPermission(
        userId,
        existingBucket.id,
        "write"
      );
      if (!hasWritePermission) {
        throw new Error("You do not have permission to modify this bucket");
      }
    }

    const userRepository = queryRunner.manager.getRepository(User);

    const user = await userRepository.findOne({
      where: { email: userEmail },
    });

    if (!user) {
      throw new Error("User does not exist");
    }

    await permissionService.revokeBucketPermission(user.id, existingBucket.id);
  });
};

export const getUserAccessList = async (bucketId: any, userId: any): Promise<any> => {
  return executeTransaction(async (queryRunner) => {
    const bucketRepository = queryRunner.manager.getRepository(Bucket);
    const existingBucket = await bucketRepository.findOne({
      where: { id: bucketId },
    });

    if (!existingBucket) throw new Error("Bucket does not exist");

    // Check if the requesting user has permission to view access list
    if (existingBucket.userId !== userId) {
      const hasReadPermission = await permissionService.hasBucketPermission(
        userId,
        existingBucket.id,
        "write"
      );
      if (!hasReadPermission) {
        throw new Error("You do not have permission to view access for this bucket");
      }
    }

    // Fetch all users with permissions on this bucket
    return (await permissionService.getBucketPermissions(bucketId)).map((it)=>({
      username:it.user.username,
      email:it.user.email,
      permissionType:it.permissionType
      
      
    }))
  });
};



export const updateVersioningService = async (
  bucketName: string,
  userId: string,
  enabled: boolean
): Promise<Bucket> => {
  return executeTransaction(async (queryRunner) => {
    const bucketRepository = queryRunner.manager.getRepository(Bucket);

    const bucket = await bucketRepository.findOne({
      where: { name: bucketName },
    });
    if (!bucket) {
      throw new Error("Bucket not found");
    }

    // Check if the user is the owner or has admin permissions
    if (bucket.userId !== userId) {
      const hasPermission = await permissionService.hasBucketPermission(
        userId,
        bucket.id,
        "admin"
      );
      if (!hasPermission) {
        throw new Error("You do not have permission to update this bucket");
      }
    }
    return await bucketRepository.save(bucket);
  });
};



export const ApprovalItemList = async (
  userId: string,
): Promise<any> => {
  return executeTransaction(async (queryRunner) => {
    const itemRepository = queryRunner.manager.getRepository(MyItem);
    const approverRepository = queryRunner.manager.getRepository(Approver);
    const objectVersionRepository = queryRunner.manager.getRepository(ObjectVersion);
    const permissionRepository = queryRunner.manager.getRepository(Permission);

    // Step 1: Check if the user is an approver in any approver groups
    const userApproverGroups = await approverRepository
      .createQueryBuilder("approver")
      .innerJoin("approver.users", "user", "user.id = :userId", { userId })
      .getMany();

    const userApproverIds = userApproverGroups.map((group) => group.id);
    
    // If user is not an approver, return empty list
    if (userApproverIds.length === 0) {
      return {  folders:[],
        files:[]};
    }

    // Step 2: First find objects that have any version requiring approval
    const objectsNeedingApproval = await objectVersionRepository
      .createQueryBuilder("version")
      .select("version.objectId")
      .distinct(true)
      .where("version.approverId IN (:...userApproverIds)", { userApproverIds })
      .andWhere("version.status = :status", { status: "pending" })
      .getRawMany();

    const objectIds = objectsNeedingApproval.map(obj => obj.version_objectId);

    // If no objects need approval, return empty list
    if (objectIds.length === 0) {
      return {  folders:[],
        files:[]};
    }

    // Step 3: Fetch ALL versions for these objects, not just the ones requiring approval
    const allVersions = await objectVersionRepository
      .createQueryBuilder("version")
      .leftJoinAndSelect("version.object", "object")
      .leftJoinAndSelect("version.uploader", "uploader")
      .leftJoinAndSelect("object.owner", "owner")
      .where("version.objectId IN (:...objectIds)", { objectIds })
      .orderBy("version.created_at", "DESC")
      .getMany();

    // Also fetch the specific versions that need approval for flagging
    const pendingVersionIds = await objectVersionRepository
      .createQueryBuilder("version")
      .select("version.id")
      .where("version.approverId IN (:...userApproverIds)", { userApproverIds })
      .andWhere("version.status = :status", { status: "pending" })
      .andWhere("version.objectId IN (:...objectIds)", { objectIds })
      .getRawMany();

    const pendingVersionIdSet = new Set(pendingVersionIds.map(v => v.version_id));

    // Step 4: Fetch all permissions for these files for the current user
    const userPermissions = await permissionRepository.find({
      where: {
        itemId: In(objectIds),
        userId: userId
      }
    });

    // Create a map of item ID to permission type for quick lookup
    const permissionMap = new Map<string, string>();
    userPermissions.forEach(perm => {
      if (perm.itemId) {
        permissionMap.set(perm.itemId, perm.permissionType);
      }
    });

    // Step 5: Group versions by object ID
    const versionsByObjectId = allVersions.reduce((acc, version) => {
      if (!acc[version.objectId]) {
        acc[version.objectId] = [];
      }
      acc[version.objectId].push(version);
      return acc;
    }, {} as Record<string, ObjectVersion[]>);

    // Step 6: Create file objects with all their versions
    const files = Object.keys(versionsByObjectId).map(objectId => {
      const versions = versionsByObjectId[objectId];
      const firstVersion = versions[0]; // Reference for object info
      
      // Map versions with needed properties and flag ones requiring approval
      const mappedVersions = versions.map(v => ({
        id: v.id,
        versionId: v.id,
        size: v.size,
        etag: v.etag,
        isLatest: v.isLatest,
        status: v.status,
        created_at: v.created_at,
        updated_at: v.updated_at,
        uploader: v.uploader ? v.uploader.username : "Unknown User",
        // Flag if this specific version needs approval
        requestingApproval: pendingVersionIdSet.has(v.id)
      }));

      // Find latest version
      const latestVersion = mappedVersions.find(v => v.isLatest) || mappedVersions[0];
      
      return {
        id: objectId,
        name: firstVersion.object.key,
        type: "file",
        bucketId: firstVersion.object.bucketId,
        userId: firstVersion.object.userId,
        created_at: firstVersion.object.created_at,
        modified: firstVersion.object.updated_at,
        owner: {
          username: firstVersion.object.owner.username,
          email: firstVersion.object.owner.email,
        },
        // Include the user's permission type for this file
        permissionType: permissionMap.get(objectId) || null,
        // Include all versions for the item
        versions: mappedVersions,
        latestVersion: latestVersion ? { ...latestVersion, name: firstVersion.object.key } : null,
        // Flag that this file has at least one version requiring approval
        hasVersionsNeedingApproval: true
      };
    });

    return { 
      folders:[],
      files:files
     };
  });
};