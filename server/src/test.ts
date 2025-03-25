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
  
      // Get all permissions and build inheritance chain
      const allPermissions = await repositories.permission.find({
        where: { userId },
        relations: ["bucket"]
      });
  
      const permissionMap = new Map<string, {
        type: string;
        inherited: boolean;
        sourceBucketId: string | null;
      }>();
  
      allPermissions.forEach(perm => {
        if (perm.bucket) {
          permissionMap.set(perm.bucket.id, {
            type: perm.permissionType,
            inherited: perm.inherited,
            sourceBucketId: perm.inherited ? perm.bucket.parentId || null : null
          });
        }
      });
  
      // Function to find original permission source
      const findPermissionSource = (bucketId: string): {type: string, sourceId: string} | null => {
        const visited = new Set<string>();
        let currentBucketId = bucketId;
        
        while (currentBucketId) {
          if (visited.has(currentBucketId)) break;
          visited.add(currentBucketId);
          
          const perm = permissionMap.get(currentBucketId);
          if (!perm) break;
          
          if (!perm.inherited) {
            return {
              type: perm.type,
              sourceId: currentBucketId
            };
          }
          
          currentBucketId = perm.sourceBucketId || "";
        }
        return null;
      };
  
      // Get all accessible buckets (direct + inherited)
      const accessibleBuckets = await repositories.bucket.find({
        where: { id: In(Array.from(permissionMap.keys())) },
        relations: ["parent"]
      });
  
      // Build inheritance tree
      const bucketTree = new Map<string, string[]>();
      accessibleBuckets.forEach(bucket => {
        if (bucket.parentId) {
          if (!bucketTree.has(bucket.parentId)) {
            bucketTree.set(bucket.parentId, []);
          }
          bucketTree.get(bucket.parentId)?.push(bucket.id);
        }
      });
  
      // Get all buckets in inheritance hierarchy
      const getAllChildBuckets = (parentId: string): string[] => {
        const children = bucketTree.get(parentId) || [];
        return children.concat(
          ...children.map(childId => getAllChildBuckets(childId))
        );
      };
  
      const allAccessibleBucketIds = new Set<string>();
      permissionMap.forEach((perm, bucketId) => {
        allAccessibleBucketIds.add(bucketId);
        if (perm.inherited) {
          getAllChildBuckets(bucketId).forEach(childId => 
            allAccessibleBucketIds.add(childId)
          );
        }
      });
  
      // Handle approvers (unchanged from original)
      const userApproverGroups = await repositories.approver
        .createQueryBuilder("approver")
        .innerJoin("approver.users", "user", "user.id = :userId", { userId })
        .getMany();
  
      const approverMap = new Map<string, string[]>();
      userApproverGroups.forEach(approver => {
        const [prefix, id] = approver.name.startsWith('bucket_') ? 
          ['bucket_', approver.name.substring(7)] :
          approver.name.startsWith('file_') ? 
          ['file_', approver.name.substring(5)] : 
          [null, null];
        
        if (id) {
          if (!approverMap.has(id)) approverMap.set(id, []);
          approverMap.get(id)?.push(approver.name);
        }
      });
  
      // Handle current location and folders
      let folders = [];
      let currentLocation = { name: "Root" };
  
      if (bucketId === undefined) {
        // Root level - show top-level accessible folders
        folders = accessibleBuckets.filter(b => 
          !b.parentId || !allAccessibleBucketIds.has(b.parentId)
        );
      } else {
        // Specific bucket requested
        const currentBucket = await repositories.bucket.findOne({
          where: { id: bucketId },
          relations: ["parent", "owner"]
        });
  
        if (!currentBucket) {
          return { currentLocation: { name: "Root" }, folders: [], files: [] };
        }
  
        currentLocation = {
          id: currentBucket.id,
          name: currentBucket.name,
          parentId: currentBucket.parentId
        };
  
        if (allAccessibleBucketIds.has(bucketId)) {
          folders = await repositories.bucket.find({
            where: { parentId: bucketId },
            relations: ["owner"]
          });
        }
      }
  
      // Process folders with inherited permissions
      const folderList = folders.map(folder => {
        const isOwner = folder.userId === userId;
        let permissionInfo = permissionMap.get(folder.id);
        let permissionType = permissionInfo?.type || (isOwner ? "owner" : null);
        
        if (!permissionType && allAccessibleBucketIds.has(folder.id)) {
          const source = findPermissionSource(folder.id);
          permissionType = source?.type || "inherited";
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
          ...(bucketApprovers.length > 0 && {
            isApprover: true,
            approverNames: bucketApprovers
          }),
          ...(isOwner && { isOwner })
        };
      });
  
      // Handle files (similar permission inheritance logic)
      let files: any[] = [];
      if (bucketId && allAccessibleBucketIds.has(bucketId)) {
        const [allFiles, allVersions] = await Promise.all([
          repositories.item.find({
            where: { bucketId },
            relations: ['owner', 'permissions']
          }),
          repositories.version.find({
            where: { object: { bucketId } },
            relations: ['uploader']
          })
        ]);
  
        // Process files with inherited permissions
        files = allFiles.map(file => {
          const isOwner = file.userId === userId;
          let permissionType = file.permissions.find(
            p => p.userId === userId
          )?.permissionType;
  
          if (!permissionType) {
            if (isOwner) {
              permissionType = "owner";
            } else if (allAccessibleBucketIds.has(bucketId)) {
              const source = findPermissionSource(bucketId);
              permissionType = source?.type || "inherited";
            }
          }
  
          // Rest of file processing (versions, approvals etc.)
          // ... (keep existing file version processing logic)
          
          return {
            // ... existing file properties
            permissionType,
            // ... other properties
          };
        }).filter(Boolean);
      }
  
      return {
        currentLocation,
        folders: folderList,
        files
      };
    });
  };



  export const listFilesByExtensionService = async (
    userId: string,
    fileExtension?: string
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
  
      // Get all permissions and build inheritance map
      const allPermissions = await repositories.permission.find({
        where: { userId },
        relations: ["bucket"]
      });
  
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
            sourceId: perm.inherited ? perm.bucket.parentId || null : null
          });
        }
      });
  
      // Function to resolve original permission
      const resolvePermission = (bucketId: string): string | null => {
        const visited = new Set<string>();
        let currentId = bucketId;
        
        while (currentId) {
          if (visited.has(currentId)) break;
          visited.add(currentId);
          
          const perm = permissionHierarchy.get(currentId);
          if (!perm) break;
          
          if (!perm.inherited) return perm.type;
          currentId = perm.sourceId || "";
        }
        return null;
      };
  
      // Get all accessible bucket IDs
      const accessibleBucketIds = Array.from(permissionHierarchy.keys());
  
      // Get all child buckets that inherit permissions
      const childBuckets = await repositories.bucket.find({
        where: { parentId: In(accessibleBucketIds) }
      });
  
      const allAccessibleBucketIds = new Set(accessibleBucketIds);
      childBuckets.forEach(b => allAccessibleBucketIds.add(b.id));
  
      // File extension filter
      const extensionCondition = fileExtension ? {
        key: Raw(alias => `LOWER(${alias}) LIKE :ext`, {
          ext: `%.${fileExtension.toLowerCase().replace(/^\./, '')}`
        })
      } : {};
  
      // Get all accessible files
      const files = await repositories.item.find({
        where: {
          bucketId: In(Array.from(allAccessibleBucketIds)),
          ...extensionCondition
        },
        relations: ['owner', 'permissions', 'bucket']
      });
  
      // Process files with permission inheritance
      const processedFiles = await Promise.all(files.map(async file => {
        const isOwner = file.userId === userId;
        let permissionType = file.permissions.find(
          p => p.userId === userId
        )?.permissionType;
  
        if (!permissionType) {
          if (isOwner) {
            permissionType = "owner";
          } else {
            permissionType = resolvePermission(file.bucketId) || null;
          }
        }
  
        // Get file versions (simplified example)
        const versions = await repositories.version.find({
          where: { objectId: file.id },
          order: { created_at: "DESC" },
          take: 5
        });
  
        return {
          id: file.id,
          name: file.key,
          bucketId: file.bucketId,
          bucketName: file.bucket.name,
          permissionType,
          versions: versions.map(v => ({
            id: v.id,
            versionId: v.versionId,
            status: v.status,
            uploadedAt: v.created_at
          })),
          owner: {
            username: file.owner.username,
            isOwner
          }
        };
      }));
  
      return {
        extension: fileExtension || "all",
        totalFiles: processedFiles.length,
        files: processedFiles
      };
    });
  };