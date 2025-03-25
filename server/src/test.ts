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
        version: queryRunner.manager.getRepository(ObjectVersion),
        user: queryRunner.manager.getRepository(User)
      };
  
      // 1. Get all permissions (direct and inherited)
      const allPermissions = await repositories.permission.find({
        where: { userId },
        relations: ["bucket", "item"]
      });
  
      // Build permission maps
      const directBucketPermissions = new Map<string, string>();
      const inheritedBucketPermissions = new Map<string, {type: string, from: string}>();
      const itemPermissions = new Map<string, string>();
  
      allPermissions.forEach(perm => {
        if (perm.item) {
          itemPermissions.set(perm.item.id, perm.permissionType);
        } else if (perm.bucket) {
          if (perm.inherited) {
            inheritedBucketPermissions.set(perm.bucket.id, {
              type: perm.permissionType,
              from: perm.bucket.parentId || ''
            });
          } else {
            directBucketPermissions.set(perm.bucket.id, perm.permissionType);
          }
        }
      });
  
      // 2. Find all accessible buckets (direct + inherited hierarchy)
      const allDirectBucketIds = Array.from(directBucketPermissions.keys());
      const allInheritedBucketIds = Array.from(inheritedBucketPermissions.keys());
  
      // Get complete bucket tree
      const allBuckets = await repositories.bucket.find({
        where: { id: In([...allDirectBucketIds, ...allInheritedBucketIds]) },
        relations: ["parent"]
      });
  
      // Build parent-child relationships
      const bucketChildren = new Map<string, string[]>();
      allBuckets.forEach(bucket => {
        if (bucket.parentId) {
          if (!bucketChildren.has(bucket.parentId)) bucketChildren.set(bucket.parentId, []);
          bucketChildren.get(bucket.parentId)?.push(bucket.id);
        }
      });
  
      // Recursively find all inheriting children
      const findAllInheritingChildren = async (parentId: string): Promise<string[]> => {
        const children = bucketChildren.get(parentId) || [];
        const grandChildren = await Promise.all(
          children.map(id => findAllInheritingChildren(id))
        );
        return [...children, ...grandChildren.flat()];
      };
  
      // Add all inheriting children to accessible buckets
      const allAccessibleBucketIds = new Set([...allDirectBucketIds, ...allInheritedBucketIds]);
      await Promise.all(
        allInheritedBucketIds.map(async bucketId => {
          const children = await findAllInheritingChildren(bucketId);
          children.forEach(id => allAccessibleBucketIds.add(id));
        })
      );
  
      // 3. Resolve permission type for any bucket
      const resolveBucketPermission = (bucketId: string): string | null => {
        // Check direct permissions first
        if (directBucketPermissions.has(bucketId)) {
          return directBucketPermissions.get(bucketId) || null;
        }
  
        // Walk up inheritance chain
        const visited = new Set<string>();
        let currentId = bucketId;
        
        while (currentId && !visited.has(currentId)) {
          visited.add(currentId);
          
          // Check if current bucket has inherited permission
          const inheritedPerm = inheritedBucketPermissions.get(currentId);
          if (inheritedPerm) {
            return inheritedPerm.type;
          }
          
          // Move up to parent
          const bucket = allBuckets.find(b => b.id === currentId);
          currentId = bucket?.parentId || '';
        }
        
        return null;
      };
  
      // 4. Handle approvers (existing logic preserved)
      const userApprovers = await repositories.approver
        .createQueryBuilder("approver")
        .innerJoin("approver.users", "user", "user.id = :userId", { userId })
        .getMany();
  
      const approverMap = new Map<string, string[]>();
      userApprovers.forEach(approver => {
        const [prefix, id] = approver.name.startsWith('bucket_') ? 
          ['bucket', approver.name.substring(7)] :
          approver.name.startsWith('file_') ? 
          ['file', approver.name.substring(5)] : 
          [null, null];
        
        if (id) {
          if (!approverMap.has(id)) approverMap.set(id, []);
          approverMap.get(id)?.push(approver.name);
        }
      });
  
      // 5. Build folder structure (existing logic preserved)
      let currentLocation = { name: "Root" };
      let folders = [];
  
      if (bucketId === undefined) {
        // Root level - show top-level accessible folders
        folders = allBuckets.filter(b => 
          !b.parentId || !allAccessibleBucketIds.has(b.parentId)
        );
      } else {
        // Specific folder requested
        const currentBucket = await repositories.bucket.findOne({
          where: { id: bucketId },
          relations: ["parent", "owner"]
        });
  
        if (!currentBucket || !allAccessibleBucketIds.has(bucketId)) {
          return { currentLocation: { name: "Root" }, folders: [], files: [] };
        }
  
        currentLocation = {
          id: currentBucket.id,
          name: currentBucket.name,
          parentId: currentBucket.parentId
        };
  
        folders = await repositories.bucket.find({
          where: { parentId: bucketId },
          relations: ["owner"]
        });
      }
   
  
      // 6. Process folders with permissions (existing + inheritance)
      const processedFolders = await Promise.all(folders.map(async folder => {
        const isOwner = folder.userId === userId;
        let permissionType = resolveBucketPermission(folder.id);
        
        if (!permissionType && isOwner) {
          permissionType = "owner";
        }
  
        // Get approval status if needed (existing logic)
        let approvalStatus = undefined;
        if (approverMap.has(folder.id)) {
          const approvals = await repositories.approval.find({
            where: { bucketId: folder.id, decision: "pending" }
          });
          approvalStatus = approvals.length > 0 ? "pending" : "approved";
        }
  
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
          approvalStatus,
          ...(approverMap.get(folder.id) && {
            isApprover: true,
            approverNames: approverMap.get(folder.id)
          }
        };
      }));
  
      // 7. Process files with permissions (existing + inheritance)
      let files = [];
      if (bucketId && allAccessibleBucketIds.has(bucketId)) {
        // Get all files in bucket (existing logic)
        const [bucketFiles, fileVersions] = await Promise.all([
          repositories.item.find({
            where: { bucketId },
            relations: ['owner', 'permissions']
          }),
          repositories.version.find({
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
  
        // Process each file (existing logic + inheritance)
        files = await Promise.all(bucketFiles.map(async file => {
          const isOwner = file.userId === userId;
          
          // Check permissions in order: item-specific > bucket inheritance > ownership
          let permissionType = itemPermissions.get(file.id);
          if (!permissionType) {
            permissionType = resolveBucketPermission(bucketId);
          }
          if (!permissionType && isOwner) {
            permissionType = "owner";
          }
  
          // Filter versions based on permissions (existing logic)
          const versions = (versionsByFile[file.id] || [])
            .filter(version => {
              // Owners can see all versions
              if (isOwner) return true;
              
              // Others can only see approved versions
              return version.status === "approved";
            })
            .map(version => ({
              id: version.id,
              versionId: version.versionId,
              status: version.status,
              size: version.size,
              uploader: version.uploader?.username || "System",
              created_at: version.created_at
            }));
  
          // Skip files with no accessible versions
          if (versions.length === 0) return null;
  
          // Check for pending approvals (existing logic)
          let approvalStatus = undefined;
          if (approverMap.has(file.id)) {
            const pendingApprovals = await repositories.approval.find({
              where: { 
                objectVersionId: In(versions.map(v => v.id)),
                decision: "pending" 
              }
            });
            approvalStatus = pendingApprovals.length > 0 ? "pending" : "approved";
          }
  
          return {
            id: file.id,
            name: file.key,
            type: "file",
            bucketId,
            permissionType,
            versions,
            latestVersion: versions[0],
            approvalStatus,
            owner: {
              username: file.owner.username,
              email: file.owner.email,
              isOwner
            },
            ...(approverMap.get(file.id) && {
              isApprover: true,
              approverNames: approverMap.get(file.id)
            })
          };
        }));
  
        // Filter out null files (those with no accessible versions)
        files = files.filter(Boolean);
      }
  
      return {
        currentLocation,
        folders: processedFolders,
        files
      };
    });
  };


  const findInheritedPermission = (folderId: string): string | null => {
    let currentId = folderId;
    while (currentId) {
      if (bucketPermissionMap.has(currentId)) {
        return bucketPermissionMap.get(currentId) || null;
      }
      const parentBucket = folders.find(folder => folder.id === currentId);
      if (!parentBucket) break;
      currentId = parentBucket.parentId || null;
    }
    return null;
  };
  
  // Format folders with correct permission inheritance tracking
  const folderList = folders.map(folder => {
    const isOwner = folder.userId === userId;
    let permissionType = bucketPermissionMap.get(folder.id) || 
                         (isOwner ? "owner" : null);
  
    // If no direct permission, check inherited source
    if (!permissionType && allAccessibleBucketIds.has(folder.id)) {
      permissionType = findInheritedPermission(folder.id);
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
  