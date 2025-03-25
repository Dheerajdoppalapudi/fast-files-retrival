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
import { deleteFile, getObjectPath } from "../utils/storage";

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

    // Get all permissions (both direct and inherited)
    const allUserPermissions = await repositories.permission
      .createQueryBuilder("permission")
      .leftJoinAndSelect("permission.bucket", "bucket")
      .where("permission.userId = :userId", { userId })
      .getMany();

    // Build maps for permissions
    const directAccessBucketIds = new Set<string>();
    const inheritedAccessBucketIds = new Set<string>();
    const bucketPermissionMap = new Map<string, string>();

    allUserPermissions.forEach(perm => {
      if (perm.bucket) {
        if (perm.inherited) {
          inheritedAccessBucketIds.add(perm.bucket.id);
        } else {
          directAccessBucketIds.add(perm.bucket.id);
        }
        bucketPermissionMap.set(perm.bucket.id, perm.permissionType);
      }
    });

    // Function to recursively get all child buckets that inherit permissions
    const getInheritedBuckets = async (parentIds: string[]): Promise<Set<string>> => {
      if (parentIds.length === 0) return new Set();
      
      const childBuckets = await repositories.bucket.find({
        where: { parentId: In(parentIds) }
      });

      const result = new Set(childBuckets.map(b => b.id));
      
      // Recursively get children of children
      const deeperChildren = await getInheritedBuckets(Array.from(result));
      deeperChildren.forEach(id => result.add(id));
      
      return result;
    };

    // Get all buckets that inherit permissions from parents
    const inheritedBuckets = await getInheritedBuckets(Array.from(inheritedAccessBucketIds));
    
    // Combine all accessible bucket IDs (direct + inherited hierarchy)
    const allAccessibleBucketIds = new Set([
      ...Array.from(directAccessBucketIds),
      ...Array.from(inheritedAccessBucketIds),
      ...Array.from(inheritedBuckets)
    ]);

    // Get approver info (unchanged)
    const userApproverGroups = await repositories.approver
      .createQueryBuilder("approver")
      .innerJoin("approver.users", "user", "user.id = :userId", { userId })
      .getMany();

    const userApproverIds = userApproverGroups.map(group => group.id);
    const isApprover = userApproverIds.length > 0;

    // Build approver map (unchanged)
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
        where: { 
          id: In(Array.from(allAccessibleBucketIds)) 
        },
        relations: ["parent","owner"],
      });

      folders = accessibleFolders.filter(folder => 
        folder.parentId === null || 
        (folder.parentId !== undefined && !allAccessibleBucketIds.has(folder.parentId))
      );
    } else {
      // Specific folder - get current folder and subfolders
      const currentBucket = await repositories.bucket.findOne({
        where: { id: bucketId },
        relations: ["parent","owner"],
      });

      if (!currentBucket) {
        return { currentLocation: { name: "Root" }, folders: [], files: [] };
      }

      currentLocation = {
        id: currentBucket.id,
        name: currentBucket.name,
        parentId: currentBucket.parentId,
      };

      if (allAccessibleBucketIds.has(bucketId)) {
        folders = await repositories.bucket.find({ 
          where: { parentId: bucketId },
          relations: ["parent","owner"],
        });
      } else {
        return { currentLocation, folders: [], files: [] };
      }
    }

    // Handle files
    let files: any[] = [];
    if (bucketId !== undefined && allAccessibleBucketIds.has(bucketId)) {
      // Get files in this bucket (no need to check permissions if bucket is accessible)
      const [allFilesInBucket, allVersions] = await Promise.all([
        repositories.item.find({
          where: { bucketId },
          relations: ['owner', 'permissions'],
        }),
        
        repositories.version
          .createQueryBuilder("version")
          .leftJoinAndSelect("version.uploader", "uploader")
          .leftJoin("version.object", "object")
          .where("object.bucketId = :bucketId", { bucketId })
          .orderBy("version.created_at", "DESC")
          .getMany()
      ]);

      const pendingApprovals = isApprover ? await repositories.approval.find({
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
      files = allFilesInBucket
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
          const isOwner = file.userId === userId;
          
          // Check if user has direct permission for this file
          const filePermission = file.permissions.find(
            perm => perm.itemId === file.id && perm.userId === userId
          );

          return {
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
              isOwner
            },
            permissionType: filePermission?.permissionType || 
                         (isOwner ? "owner" : 
                          (allAccessibleBucketIds.has(bucketId) ? bucketPermissionMap.get(bucketId) : null)),
            latestVersion: latestVersion && { ...latestVersion, name: file.key },
            versions: filteredVersions,
            ...(fileApprovers.length > 0 ? {
              isApprover: true,
              approverNames: fileApprovers
            } : {}),
            ...(isOwner ? { isOwner } : {})
          };
        })
        .filter(Boolean);
    }

    // Format folders with permissions
    const folderList = folders.map(folder => {
      const isOwner = folder.userId === userId;
      let permissionType = bucketPermissionMap.get(folder.id) || 
                         (isOwner ? "owner" : null);
      
      // If no direct permission but accessible through inheritance
      if (!permissionType && allAccessibleBucketIds.has(folder.id)) {
        permissionType = "inherited";
      }

      const bucketApprovers = approverMap.get(folder.id) || [];
      
      return {
        id: folder.id,
        name: folder.name,
        type: "folder",
        parentId: folder.parentId,
        modified: folder.updated_at,
        owner: {
          username: folder.owner.username,
          email: folder.owner.email,
          isOwner
        },
        permissionType,
        ...(bucketApprovers.length > 0 ? {
          isApprover: true,
          approverNames: bucketApprovers
        } : {}),
        ...(isOwner ? { isOwner } : {})
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
    const versionRepository = queryRunner.manager.getRepository(ObjectVersion);

    // Step 1: Get all permissions (both direct and inherited)
    const allUserPermissions = await permissionRepository
      .createQueryBuilder("permission")
      .leftJoinAndSelect("permission.bucket", "bucket")
      .where("permission.userId = :userId", { userId })
      .getMany();

    // Build maps for permissions
    const directAccessBucketIds = new Set<string>();
    const inheritedAccessBucketIds = new Set<string>();
    const bucketPermissionMap = new Map<string, string>();

    allUserPermissions.forEach(perm => {
      if (perm.bucket) {
        if (perm.inherited) {
          inheritedAccessBucketIds.add(perm.bucket.id);
        } else {
          directAccessBucketIds.add(perm.bucket.id);
        }
        bucketPermissionMap.set(perm.bucket.id, perm.permissionType);
      }
    });

    // Function to recursively get all child buckets that inherit permissions
    const getInheritedBuckets = async (parentIds: string[]): Promise<Set<string>> => {
      if (parentIds.length === 0) return new Set();
      
      const childBuckets = await bucketRepository.find({
        where: { parentId: In(parentIds) }
      });

      const result = new Set(childBuckets.map(b => b.id));
      
      // Recursively get children of children
      const deeperChildren = await getInheritedBuckets(Array.from(result));
      deeperChildren.forEach(id => result.add(id));
      
      return result;
    };

    // Get all buckets that inherit permissions from parents
    const inheritedBuckets = await getInheritedBuckets(Array.from(inheritedAccessBucketIds));
    
    // Combine all accessible bucket IDs (direct + inherited hierarchy)
    const allAccessibleBucketIds = new Set([
      ...Array.from(directAccessBucketIds),
      ...Array.from(inheritedAccessBucketIds),
      ...Array.from(inheritedBuckets)
    ]);

    // Check if user is an approver in any approver groups
    const userApproverGroups = await approverRepository
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
        
        if (name.startsWith('file_')) {
          prefix = 'file_';
          id = name.substring(5);
          if (!approverMap.has(id)) {
            approverMap.set(id, []);
          }
          approverMap.get(id)?.push(name);
        }
      });
    }

    // Step 2: Prepare file extension filter if provided
    let fileExtensionCondition = {};
    if (fileExtension) {
      const ext = fileExtension.toLowerCase().replace(/^\./, '');
      fileExtensionCondition = {
        key: Raw(alias => `LOWER(${alias}) LIKE :extension`, { 
          extension: `%.${ext}` 
        })
      };
    }

    // Step 3: Get all files in accessible buckets (including inherited)
    const accessibleBucketIdsArray = Array.from(allAccessibleBucketIds);

    console.log(accessibleBucketIdsArray)
    
    // Get files the user owns with the specified extension
    const ownedFiles = await itemRepository.find({
      where: {
        bucketId: In(accessibleBucketIdsArray),
        ...fileExtensionCondition
      },
      relations: ['owner']
    });
    // Get files the user has explicit permissions for with the specified extension
    const permittedFilesPermissions = await permissionRepository
      .createQueryBuilder("permission")
      .leftJoinAndSelect("permission.item", "item")
      .leftJoinAndSelect("item.owner", "owner")
      .where("permission.userId = :userId", { userId })
      .andWhere("permission.itemId IS NOT NULL")
      .andWhere("item.bucketId IN (:...bucketIds)", { bucketIds: accessibleBucketIdsArray })
      .getMany();

    // Filter permitted files by extension if needed
    let filteredPermittedFilesPermissions = permittedFilesPermissions;
    if (fileExtension) {
      const ext = fileExtension.toLowerCase().replace(/^\./, '');
      filteredPermittedFilesPermissions = permittedFilesPermissions.filter(perm => 
        perm.item?.key?.toLowerCase().endsWith(`.${ext}`)
      );
    }

    // Combine all accessible files (owned + permitted + inherited access)
    const allAccessibleFiles = [
      ...ownedFiles,
      ...filteredPermittedFilesPermissions.map(p => p.item).filter(Boolean)
    ].filter((file, index, self) =>
      index === self.findIndex(f => f.id === file.id)
    );

    let files = [] as any;
    if (allAccessibleFiles.length > 0) {
      // Batch fetch all versions for these files in one query
      const allVersions = await versionRepository
        .createQueryBuilder("version")
        .leftJoinAndSelect("version.uploader", "uploader")
        .where("version.objectId IN (:...fileIds)", { 
          fileIds: allAccessibleFiles.map(f => f.id) 
        })
        .orderBy("version.created_at", "DESC")
        .getMany();

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

      // Group versions by file ID for faster access
      const versionsByFileId: { [key: string]: ObjectVersion[] } = {};
      allVersions.forEach(version => {
        if (!versionsByFileId[version.objectId]) {
          versionsByFileId[version.objectId] = [];
        }
        versionsByFileId[version.objectId].push(version);
      });

      // Group approvals by version ID
      const approvalsByVersionId: { [key: string]: Approval } = {};
      pendingApprovals.forEach(approval => {
        if (approval.objectVersionId) {
          approvalsByVersionId[approval.objectVersionId] = approval;
        }
      });

      // Process each file
      for (const file of allAccessibleFiles) {
        const fileVersions = versionsByFileId[file.id] || [];
        
        // Filter versions based on user's role and access
        const filteredVersions = fileVersions
          .map(version => {
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

        // Skip files with no accessible versions
        if (filteredVersions.length === 0) continue;

        const latestVersion = filteredVersions.find(it => it.isLatest) || null;
        const fileApprovers = approverMap.get(file.id) || [];
        const isOwner = file.userId === userId;
        
        // Determine permission type (direct, inherited, or owner)
        let permissionType = file.permissions?.find(
          perm => perm.itemId === file.id && perm.userId === userId
        )?.permissionType;

        if (!permissionType) {
          if (isOwner) {
            permissionType = "owner";
          } else if (allAccessibleBucketIds.has(file.bucketId)) {
            permissionType = "inherited";
          }
        }

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
            isOwner
          },
          permissionType,
          latestVersion: latestVersion && { ...latestVersion, name: file.key },
          versions: filteredVersions,
          ...(fileApprovers.length > 0 ? {
            isApprover: true,
            approverNames: fileApprovers
          } : {}),
          ...(isOwner ? { isOwner } : {})
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
        path: bucket.name, // You might want to build a full path here
        parentId: bucket.parentId
      };
    });

    return {
      extension: fileExtension || "all",
      totalFiles: files.length,
      folders: [], // Maintain consistent structure with listBucketContentsService
      files: files,
      // filesByBucket: files.map(file => ({
      //   ...file,
      //   bucketInfo: bucketIdToInfo[file.bucketId] || { name: "Unknown", path: "Unknown" }
      // }))
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



export const deleteBucketService = async (userId: string, bucketId: string): Promise<{ message: string }> => {
  return executeTransaction(async (queryRunner) => {
    const bucketRepository = queryRunner.manager.getRepository(Bucket);
    const itemRepository = queryRunner.manager.getRepository(MyItem);
    const versionRepository = queryRunner.manager.getRepository(ObjectVersion);

    const bucket = await bucketRepository.findOne({ where: { id: bucketId }, relations: ['children'] });
    if (!bucket) throw new Error('Bucket not found');

    // Check permissions
    if (bucket.userId !== userId) {
      const hasDeletePermission = await permissionService.hasBucketPermission(userId, bucketId, 'delete');
      if (!hasDeletePermission) {
        throw new Error('You do not have permission to delete this bucket');
      }
    }

    // Recursive function to delete nested buckets
    const deleteBucketRecursively = async (bucketId: string) => {
      const childBuckets = await bucketRepository.find({ where: { parentId: bucketId } });
      for (const child of childBuckets) {
        await deleteBucketRecursively(child.id);
      }

      // Find all items in the bucket
      const items = await itemRepository.find({ where: { bucketId } });
      for (const item of items) {
        // Find all versions of each item
        const versions = await versionRepository.find({ where: { objectId: item.id } });

        // Delete all version files
        for (const version of versions) {
          const objectPath = getObjectPath(bucket.name, item.key, version.id);
          deleteFile(objectPath);
        }

        // Delete item and its versions from the database
        await versionRepository.delete({ objectId: item.id });
        await itemRepository.delete(item.id);
      }

      // Delete the bucket
      await bucketRepository.delete(bucketId);
    };

    // Start deletion process from the root bucket
    await deleteBucketRecursively(bucketId);

    return { message: 'Bucket and all its nested buckets and items deleted successfully' };
  });
};
