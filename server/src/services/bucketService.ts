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
  
      // Step 2: Handle root view or specific folder view
      let folders = [];
      let currentLocation: { id?: string; name: string; parentId?: string } = { name: "Root" };
  
      if (bucketId === undefined) {
        // At root level - fetch all accessible folders with parent info in one query
        const accessibleFolders = await bucketRepository.find({
          where: { id: In(Array.from(directAccessBucketIds)) },
          relations: ["parent"],
        });
  
        // Create a set of all accessible parent IDs in one pass
        const accessibleParentIds = new Set<string>();
        accessibleFolders.forEach((folder) => {
          if (folder.parentId && directAccessBucketIds.has(folder.parentId)) {
            accessibleParentIds.add(folder.parentId);
          }
        });
  
        // Filter to get only top-level folders
        folders = accessibleFolders.filter((folder) => {
          return folder.parentId === null || 
                 (folder.parentId !== undefined && !directAccessBucketIds.has(folder.parentId));
        });
      } else {
        // Inside a specific folder - get current folder and subfolders in one query
        const currentBucket = await bucketRepository.findOne({
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
  
        // Check if user has access to this bucket
        if (directAccessBucketIds.has(bucketId)) {
          // User has direct access, get all subfolders at once
          folders = await bucketRepository.find({
            where: { parentId: bucketId },
          });
        } else {
          // No direct access
          return { currentLocation, folders: [], files: [] };
        }
      }
  
      // Step 3: Optimize file retrieval if in a specific bucket
      let files: any[] = [];
      if (bucketId !== undefined) {
        // Combine file permission queries into a single operation
        const [permittedFilesPermissions, ownedFiles] = await Promise.all([
          permissionRepository
            .createQueryBuilder("permission")
            .leftJoinAndSelect("permission.item", "item")
            .where("permission.userId = :userId", { userId })
            .andWhere("permission.itemId IS NOT NULL")
            .andWhere("item.bucketId = :bucketId", { bucketId })
            .getMany(),
          
          itemRepository.find({
            where: { bucketId, userId },
          })
        ]);
  
        const permittedFileIds = permittedFilesPermissions
          .map((perm) => perm.item?.id)
          .filter((id) => id !== undefined) as string[];
        
        const ownedFileIds = ownedFiles.map((file) => file.id);
  
        // Combine all accessible file IDs and remove duplicates
        const accessibleFileIds = [
          ...new Set([...permittedFileIds, ...ownedFileIds]),
        ];
  
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
  
            // Add file to response with accessible versions
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
            });
          }
        }
      }
  
      // Step 4: More efficiently get permissions for folders
      // Fetch all folder IDs that need permission checks
      const folderIds = folders.map(folder => folder.id);
      
      // Get any missing permissions in one batch query
      const missingFolderIds = folderIds.filter(id => !bucketPermissionMap.has(id));
      
      // Only query if there are missing permissions
      if (missingFolderIds.length > 0) {
        const additionalPermissions = await permissionRepository.find({
          where: {
            bucketId: In(missingFolderIds),
            userId: userId
          }
        });
        
        // Add these to our permission map
        additionalPermissions.forEach(perm => {
          if (perm.bucketId) {
            bucketPermissionMap.set(perm.bucketId, perm.permissionType);
          }
        });
      }
      
      // Format folders with permission types
      const folderList = folders.map(folder => {
        // Get permission type from map or determine ownership
        let permissionType = bucketPermissionMap.get(folder.id) || null;
        
        // If not found and user is the owner, set to "owner"
        if (!permissionType && folder.userId === userId) {
          permissionType = "owner";
        }
        
        return {
          id: folder.id,
          name: folder.name,
          type: "folder",
          parentId: folder.parentId,
          modified: folder.updated_at,
          permissionType: permissionType
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
  
          // Add file to response with accessible versions
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
    const existingBucket = await bucketRepository.findOne({
      where: { name: bucketName, userId },
    });

    if (existingBucket) throw new Error("Bucket already exists");

    const bucket = new Bucket();
    bucket.name = bucketName;
    bucket.userId = userId;
    bucket.parentId = bucketParentId;

    await bucketRepository.save(bucket);
    await permissionService.assignBucketPermission(userId, bucket.id);

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
