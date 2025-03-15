import { IsNull } from "typeorm";
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
  userId: any,
  bucketId?: number
): Promise<any> => {
  return executeTransaction(async (queryRunner) => {
    const bucketRepository = queryRunner.manager.getRepository(Bucket);
    const itemRepository = queryRunner.manager.getRepository(MyItem);
    const permissionRepository = queryRunner.manager.getRepository(Permission);
    const approverRepository = queryRunner.manager.getRepository(Approver);
    const approvalRepository = queryRunner.manager.getRepository(Approval);

    // Step 1: Get all buckets that the user has direct access to
    const userPermissions = await permissionRepository
      .createQueryBuilder("permission")
      .leftJoinAndSelect("permission.bucket", "bucket")
      .where("permission.userId = :userId", { userId })
      .getMany();

    // Extract bucket IDs the user has direct permissions to
    const directAccessBucketIds = new Set<number>();
    userPermissions.forEach((perm) => {
      if (perm.bucket) directAccessBucketIds.add(perm.bucket.id);
    });

    console.log("User Accessible Folders:", Array.from(directAccessBucketIds));

    // Check if user is an approver in any approver groups
    const userApproverGroups = await approverRepository
      .createQueryBuilder("approver")
      .innerJoin("approver.users", "user", "user.id = :userId", { userId })
      .getMany();

    const userApproverIds = userApproverGroups.map((group) => group.id);
    const isApprover = userApproverIds.length > 0;

    console.log("User is approver in groups:", userApproverIds);

    // Step 2: Handle root view or specific folder view
    let folders = [];
    let currentLocation = { name: "Root" };

    if (bucketId === undefined) {
      // At root level - we want to show the top-level accessible folders

      // Get all accessible folders with parent info
      const accessibleFolders = await bucketRepository.find({
        where: { id: In(Array.from(directAccessBucketIds)) },
        relations: ["parent"],
      });

      // Create a set of all accessible parent IDs
      const accessibleParentIds = new Set<number>();
      accessibleFolders.forEach((folder) => {
        if (folder.parentId && directAccessBucketIds.has(folder.parentId)) {
          accessibleParentIds.add(folder.parentId);
        }
      });

      // Filter to get only top-level folders (those whose parents the user doesn't have access to)
      folders = accessibleFolders.filter((folder) => {
        // Include true root folders
        if (folder.parentId === null) return true;

        // Include folders whose parent is not directly accessible to the user
        return !directAccessBucketIds.has(folder.parentId);
      });
    } else {
      // Inside a specific folder
      const currentBucket = await bucketRepository.findOne({
        where: { id: bucketId },
        relations: ["parent"],
      });

      if (!currentBucket) {
        return { currentLocation: { name: "Root" }, folders: [], files: [] };
      }

      // Update current location info
      currentLocation = {
        id: currentBucket.id,
        name: currentBucket.name,
        parentId: currentBucket.parentId,
      };

      // Check if user has access to this bucket
      if (directAccessBucketIds.has(bucketId)) {
        // User has direct access, show all subfolders
        folders = await bucketRepository.find({
          where: { parentId: bucketId },
        });
      } else {
        // No direct access
        return { currentLocation, folders: [], files: [] };
      }
    }

    console.log(
      "Fetched Folders:",
      folders.map((f) => f.id)
    );

    // Step 3: Fetch files in the current bucket (if applicable)
    let files = [];
    if (bucketId !== undefined) {
      // Get files that the user has explicit permissions for
      const permittedFilesPermissions = await permissionRepository
        .createQueryBuilder("permission")
        .leftJoinAndSelect("permission.item", "item")
        .where("permission.userId = :userId", { userId })
        .andWhere("permission.itemId IS NOT NULL")
        .andWhere("item.bucketId = :bucketId", { bucketId })
        .getMany();

      const permittedFileIds = permittedFilesPermissions
        .map((perm) => perm.item?.id)
        .filter((id) => id !== undefined) as number[];

      // Get files owned by the user in this bucket
      const ownedFiles = await itemRepository.find({
        where: { bucketId, userId },
      });

      const ownedFileIds = ownedFiles.map((file) => file.id);

      // Combine all accessible file IDs
      const accessibleFileIds = [
        ...new Set([...permittedFileIds, ...ownedFileIds]),
      ];

      if (accessibleFileIds.length > 0) {
        // Fetch all accessible files
        const allAccessibleFiles = await itemRepository.find({
          where: { id: In(accessibleFileIds) },
        });

        // Process each file to get appropriate versions
        for (const file of allAccessibleFiles) {
          // Get all versions for this file
          // Get all versions for this file with uploader information
          const versions = await queryRunner.manager
          .getRepository(ObjectVersion)
          .find({
            where: { objectId: file.id },
            relations: ['uploader'], // Include the uploader relation
            order: { createdAt: 'DESC' }
          });



console.log(versions)

          // Filter versions based on user's role and access
          const filteredVersions = await Promise.all(
            versions.map(async (version) => {
              // Case 1: User is the uploader of this version - can see it
              if (version.userId === userId) {
                return {
                  ...version,
                  uploader: version.uploader ? version.uploader.username : 'Unknown User'
                };
              }

              // Case 2: User is an approver for this version - can see it
              if (isApprover) {
                // Check if this user is an approver for this specific version
                // Check if this user is an approver for this specific version
                const pendingApproval = await approvalRepository.findOne({
                  where: [
                    // Case 1: Direct user approval (unanimous approval case)
                    {
                      objectVersionId: version.id,
                      approverId: In(userApproverIds),
                      userId: userId,
                      decision: "pending",
                    },
                    // Case 2: Group approval with no specific user assigned yet (standard approval case)
                    {
                      objectVersionId: version.id,
                      approverId: In(userApproverIds),
                      userId: IsNull(),
                      decision: "pending",
                    },
                  ],
                });

                // console.log(pendingApproval)

                if (pendingApproval) {
                  return {
                    ...version,
                    uploader: version.uploader ? version.uploader.username : 'Unknown User'
                  };
                }
              }

              // Case 3: Regular user with access - can only see approved versions
              return version.status === 'approved' ? {
                ...version,
                uploader: version.uploader ? version.uploader.username : 'Unknown User'
              } : null;
            })
          );

          // Remove null values (versions user can't see)
          const accessibleVersions = filteredVersions.filter((v) => v !== null);

          // Skip files with no accessible versions
          if (accessibleVersions.length === 0) continue;

          // Add file to response with accessible versions
          files.push({
            id: file.id,
            name: file.key,
            type: "file",
            bucketId: file.bucketId,
            userId: file.userId,
            latestVersion: accessibleVersions[0]
              ? {
                  versionId: accessibleVersions[0].versionId,
                  size: accessibleVersions[0].size,
                  createdAt: accessibleVersions[0].createdAt,
                  status: accessibleVersions[0].status,
                }
              : null,
            versions: accessibleVersions,
          });
        }
      }
    }

    // Step 4: Format folders for the response
    const folderList = folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      type: "folder",
      parentId: folder.parentId,
      userId: folder.userId,
    }));

    return {
      currentLocation,
      folders: folderList,
      files,
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
  userEmail: string
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
      existingBucket.id
    );
  });
};

export const updateVersioningService = async (
  bucketName: string,
  userId: number,
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
