import { AppDataSource } from '../config/db';
import { Permission } from '../models/Permission';

export class PermissionService {
  private permissionRepository = AppDataSource.getRepository(Permission);

  async hasBucketPermission(userId: any, bucketId: number, permissionType: string = 'write'): Promise<boolean> {
    const bucketPermission = await this.permissionRepository.findOne({
      where: { userId, bucketId, permissionType },
    });
    return !!bucketPermission;
  }

  async hasItemPermission(userId: any, itemId: number, permissionType: string = 'write'): Promise<boolean> {
    const itemPermission = await this.permissionRepository.findOne({
      where: { userId, itemId, permissionType },
    });
    return !!itemPermission;
  }

  async assignItemPermission(userId: any, itemId?: number, permissionType: string = 'write'): Promise<Permission> {
    const permission = new Permission();
    permission.userId = userId;
    permission.permissionType = permissionType;

    if (itemId) {
      permission.itemId = itemId;
    } else {
      throw new Error(' itemId must be provided');
    }

    return await this.permissionRepository.save(permission);
  }

  async assignBucketPermission(userId: any, bucketId?: number, permissionType: string = 'write'): Promise<Permission> {
    const permission = new Permission();
    permission.userId = userId;
    permission.permissionType = permissionType;

    if (bucketId) {
      permission.bucketId = bucketId;
    } else {
      throw new Error(' bucketId must be provided');
    }

    return await this.permissionRepository.save(permission);
  }
}
