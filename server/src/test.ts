import { Entity, In, IsNull, Raw } from "typeorm";
import { executeTransaction } from "./database";
import { Bucket, MyItem, Permission, Approver, Approval, ObjectVersion, User } from "./models";

export const listBucketContentsService = async (
  userId: string,
  bucketId?: string
): Promise<any> => {
  return executeTransaction(async (queryRunner) => {
    // Initialize repositories
    const bucketRepo = queryRunner.manager.getRepository(Bucket);
    const itemRepo = queryRunner.manager.getRepository(MyItem);
    const permissionRepo = queryRunner.manager.getRepository(Permission);
    const approverRepo = queryRunner.manager.getRepository(Approver);
    const approvalRepo = queryRunner.manager.getRepository(Approval);
    const versionRepo = queryRunner.manager.getRepository(ObjectVersion);

    // Step 1: Load all permissions and build inheritance tree
    const allPermissions = await permissionRepo.find({
      where: { userId },
      relations: ["bucket"]
    });

    // Build permission maps
    const directPermissionMap = new Map<string, string>();
    const inheritedPermissionMap = new Map<string, {type: string, from: string}>();
    const allAccessibleBuckets = new Set<string>();

    allPermissions.forEach(perm => {
      if (!perm.bucket) return;
      
      allAccessibleBuckets.add(perm.bucket.id);
      if (perm.inherited) {
        inheritedPermissionMap.set(perm.bucket.id, {
          type: perm.permissionType,
          from: perm.bucket.parentId || ''
        });
      } else {
        directPermissionMap.set(perm.bucket.id, perm.permissionType);
      }
    });

    // Step 2: Find all inheriting child buckets
    const findInheritingChildren = async (parentId: string): Promise<string[]> => {
      const children = await bucketRepo.find({ 
        where: { parentId },
        select: ["id"]
      });
      
      const childIds = children.map(c => c.id);
      const grandChildren = await Promise.all(
        childIds.map(id => findInheritingChildren(id))
      );
      
      return [...childIds, ...grandChildren.flat()];
    };

    // Add all inheriting children to accessible buckets
    await Promise.all(
      Array.from(inheritedPermissionMap.keys()).map(async bucketId => {
        const children = await findInheritingChildren(bucketId);
        children.forEach(id => allAccessibleBuckets.add(id));
      })
    );

    // Step 3: Resolve permission types including inheritance
    const resolvePermissionType = (bucketId: string): string | null => {
      // Check for direct permission first
      if (directPermissionMap.has(bucketId)) {
        return directPermissionMap.get(bucketId) || null;
      }

      // Walk up inheritance chain
      const visited = new Set<string>();
      let currentId = bucketId;
      
      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        
        const inheritedPerm = inheritedPermissionMap.get(currentId);
        if (inheritedPerm) {
          return inheritedPerm.type;
        }
        
        // Move up hierarchy
        const parent = bucketTree.get(currentId);
        currentId = parent || '';
      }
      
      return null;
    };

    // Step 4: Build bucket tree structure
    const allBuckets = await bucketRepo.find({
      where: { id: In(Array.from(allAccessibleBuckets)) },
      relations: ["parent"]
    });

    const bucketTree = new Map<string, string>();
    allBuckets.forEach(b => {
      if (b.parentId) bucketTree.set(b.id, b.parentId);
    });

    // Step 5: Handle approvers
    const userApprovers = await approverRepo
      .createQueryBuilder("approver")
      .innerJoin("approver.users", "user", "user.id = :userId", { userId })
      .getMany();

    const approverMap = new Map<string, string[]>();
    userApprovers.forEach(approver => {
      const [type, id] = approver.name.includes('_') ? 
        approver.name.split('_') : [null, null];
      
      if (id && (type === 'bucket' || type === 'file')) {
        if (!approverMap.has(id)) approverMap.set(id, []);
        approverMap.get(id)?.push(approver.name);
      }
    });

    // Step 6: Build folder structure
    let currentLocation = { name: "Root" };
    let folders = [];

    if (bucketId === undefined) {
      // Root level - show top-level accessible folders
      folders = allBuckets.filter(b => 
        !b.parentId || !allAccessibleBuckets.has(b.parentId)
      );
    } else {
      // Specific folder requested
      const currentBucket = await bucketRepo.findOne({
        where: { id: bucketId },
        relations: ["parent", "owner"]
      });

      if (!currentBucket || !allAccessibleBuckets.has(bucketId)) {
        return { currentLocation: { name: "Root" }, folders: [], files: [] };
      }

      currentLocation = {
        id: currentBucket.id,
        name: currentBucket.name,
        parentId: currentBucket.parentId
      };

      folders = await bucketRepo.find({
        where: { parentId: bucketId },
        relations: ["owner"]
      });
    }

    // Step 7: Process folders with permissions
    const processedFolders = folders.map(folder => {
      const isOwner = folder.userId === userId;
      const permissionType = resolvePermissionType(folder.id) || 
                           (isOwner ? "owner" : null);
      
      return {
        id: folder.id,
        name: folder.name,
        type: "folder",
        parentId: folder.parentId,
        owner: {
          username: folder.owner.username,
          isOwner
        },
        permissionType,
        ...(approverMap.get(folder.id) && {
          isApprover: true,
          approverNames: approverMap.get(folder.id)
        })
      };
    });

    // Step 8: Process files with inherited permissions
    let files = [];
    if (bucketId && allAccessibleBuckets.has(bucketId)) {
      const [bucketFiles, fileVersions] = await Promise.all([
        itemRepo.find({
          where: { bucketId },
          relations: ['owner', 'permissions']
        }),
        versionRepo.find({
          where: { object: { bucketId } },
          order: { created_at: "DESC" },
          relations: ['uploader']
        })
      ]);

      // Group versions by file
      const versionsByFile = fileVersions.reduce((acc, version) => {
        if (!acc[version.objectId]) acc[version.objectId] = [];
        acc[version.objectId].push(version);
        return acc;
      }, {} as Record<string, typeof fileVersions>);

      files = bucketFiles.map(file => {
        const isOwner = file.userId === userId;
        let permissionType = file.permissions.find(
          p => p.userId === userId
        )?.permissionType;

        if (!permissionType) {
          permissionType = isOwner ? "owner" : resolvePermissionType(bucketId);
        }

        const versions = (versionsByFile[file.id] || [])
          .filter(v => v.status === "approved" || v.userId === userId)
          .map(v => ({
            id: v.id,
            versionId: v.versionId,
            status: v.status,
            uploader: v.uploader?.username || "System"
          }));

        return {
          id: file.id,
          name: file.key,
          type: "file",
          bucketId,
          permissionType,
          versions,
          latestVersion: versions[0],
          owner: {
            username: file.owner.username,
            isOwner
          },
          ...(approverMap.get(file.id) && {
            isApprover: true,
            approverNames: approverMap.get(file.id)
          })
        };
      });
    }

    return {
      currentLocation,
      folders: processedFolders,
      files
    };
  });
};




import { In, Raw } from "typeorm";
import { executeTransaction } from "./database";
import { Bucket, MyItem, Permission, Approver, ObjectVersion } from "./models";

export const listFilesByExtensionService = async (
  userId: string,
  fileExtension?: string
): Promise<any> => {
  return executeTransaction(async (queryRunner) => {
    // Initialize repositories
    const bucketRepo = queryRunner.manager.getRepository(Bucket);
    const itemRepo = queryRunner.manager.getRepository(MyItem);
    const permissionRepo = queryRunner.manager.getRepository(Permission);
    const approverRepo = queryRunner.manager.getRepository(Approver);
    const versionRepo = queryRunner.manager.getRepository(ObjectVersion);

    // Step 1: Load all permissions
    const allPermissions = await permissionRepo.find({
      where: { userId },
      relations: ["bucket"]
    });

    // Step 2: Build permission hierarchy
    const permissionHierarchy = new Map<string, {
      type: string;
      inherited: boolean;
      sourceId: string | null;
    }>();

    allPermissions.forEach(perm => {
      if (perm.bucket) {
        permissionHierarchy.set(perm.bucket.id, {
          type: perm.permissionType,
          inherited: perm.inherited,
          sourceId: perm.inherited ? perm.bucket.parentId : null
        });
      }
    });

    // Step 3: Find all accessible buckets
    const accessibleBucketIds = Array.from(permissionHierarchy.keys());
    const allBuckets = await bucketRepo.find({
      where: { id: In(accessibleBucketIds) },
      select: ["id", "parentId"]
    });

    // Build bucket parent-child relationships
    const bucketTree = new Map<string, string[]>();
    allBuckets.forEach(bucket => {
      if (bucket.parentId) {
        if (!bucketTree.has(bucket.parentId)) bucketTree.set(bucket.parentId, []);
        bucketTree.get(bucket.parentId)?.push(bucket.id);
      }
    });

    // Recursively find all inheriting children
    const findAllChildren = (parentId: string): string[] => {
      const children = bucketTree.get(parentId) || [];
      return children.concat(...children.map(findAllChildren));
    };

    const allAccessibleBucketIds = new Set(accessibleBucketIds);
    permissionHierarchy.forEach((perm, bucketId) => {
      if (perm.inherited) {
        findAllChildren(bucketId).forEach(childId => 
          allAccessibleBucketIds.add(childId)
        );
      }
    });

    // Step 4: Apply file extension filter if provided
    const extensionCondition = fileExtension ? {
      key: Raw(alias => `LOWER(${alias}) LIKE :ext`, {
        ext: `%.${fileExtension.toLowerCase().replace(/^\./, '')}`
      })
    } : {};

    // Step 5: Find all accessible files
    const files = await itemRepo.find({
      where: {
        bucketId: In(Array.from(allAccessibleBucketIds)),
        ...extensionCondition
      },
      relations: ['owner', 'bucket']
    });

    // Step 6: Resolve permission types
    const resolvePermission = (bucketId: string): string | null => {
      let currentId = bucketId;
      const visited = new Set<string>();
      
      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const perm = permissionHierarchy.get(currentId);
        
        if (perm && !perm.inherited) return perm.type;
        currentId = perm?.sourceId || '';
      }
      return null;
    };

    // Step 7: Load versions in batch
    const fileIds = files.map(f => f.id);
    const allVersions = fileIds.length > 0 ? await versionRepo.find({
      where: { objectId: In(fileIds) },
      order: { created_at: "DESC" }
    }) : [];

    // Group versions by file
    const versionsByFile = allVersions.reduce((acc, version) => {
      if (!acc[version.objectId]) acc[version.objectId] = [];
      acc[version.objectId].push(version);
      return acc;
    }, {} as Record<string, typeof allVersions>);

    // Step 8: Process files with permissions
    const processedFiles = files.map(file => {
      const isOwner = file.userId === userId;
      const permissionType = resolvePermission(file.bucketId) || 
                          (isOwner ? "owner" : null);
      
      const versions = (versionsByFile[file.id] || [])
        .filter(v => v.status === "approved" || v.userId === userId)
        .map(v => ({
          id: v.id,
          versionId: v.versionId,
          status: v.status,
          created_at: v.created_at
        }));

      return {
        id: file.id,
        name: file.key,
        bucketId: file.bucketId,
        bucketName: file.bucket.name,
        permissionType,
        versions,
        latestVersion: versions[0],
        owner: {
          username: file.owner.username,
          isOwner
        }
      };
    });

    return {
      extension: fileExtension || "all",
      totalFiles: processedFiles.length,
      files: processedFiles
    };
  });
};