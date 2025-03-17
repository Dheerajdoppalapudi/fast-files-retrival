import { AppDataSource } from '../config/db';
import { Permission } from '../models/Permission';

export class PermissionService {
  private permissionRepository = AppDataSource.getRepository(Permission);

  async hasBucketPermission(userId: any, bucketId: string, permissionType: string = 'write'): Promise<boolean> {
    const bucketPermission = await this.permissionRepository.findOne({
      where: { userId, bucketId, permissionType },
    });
    return !!bucketPermission;
  }

  async getBucketPermissions(bucketId: string): Promise<Permission[]> {
    const bucketPermissions = await this.permissionRepository.find({
      where: { bucketId },
      relations:['user']
    });

  
    return bucketPermissions
  }
  

  async hasItemPermission(userId: any, itemId: string, permissionType: string = 'write'): Promise<boolean> {
    const itemPermission = await this.permissionRepository.findOne({
      where: { userId, itemId, permissionType },
    });
    return !!itemPermission;
  }

  async getItemPermissions(itemId: string): Promise<Permission[]> {
    const itemPermissions = await this.permissionRepository.find({
      where: { itemId },
      relations:['user']
    });
  
    return itemPermissions
  }
  

  async assignItemPermission(userId: any, itemId?: string, permissionType: string = 'write'): Promise<Permission> {
    const isPermissionExist = await this.permissionRepository.findOne({
      where: { itemId, userId },
    });
    if (isPermissionExist) {
      if (isPermissionExist.permissionType !== permissionType) {
        isPermissionExist.permissionType = permissionType;
        return await this.permissionRepository.save(isPermissionExist);
      }
      throw new Error('User already has access to this permission');
    }

    if (!itemId) {
      throw new Error('itemId must be provided');
    }

    const permission = new Permission();
    permission.userId = userId;
    permission.permissionType = permissionType;
    permission.itemId = itemId;

    return await this.permissionRepository.save(permission);
  }

  async assignBucketPermission(userId: any, bucketId?: string, permissionType: string = 'write'): Promise<Permission> {
    const isPermissionExist = await this.permissionRepository.findOne({
      where: { bucketId, userId },
    });
    if (isPermissionExist) {
      if (isPermissionExist.permissionType !== permissionType) {
        isPermissionExist.permissionType = permissionType;
        return await this.permissionRepository.save(isPermissionExist);
      }
      throw new Error('User already has access to this permission');
    }

    if (!bucketId) {
      throw new Error('bucketId must be provided');
    }

    const permission = new Permission();
    permission.userId = userId;
    permission.permissionType = permissionType;
    permission.bucketId = bucketId;

    return await this.permissionRepository.save(permission);
  }

  async revokeItemPermission(userId: any, itemId: string): Promise<boolean> {
    const itemPermission = await this.permissionRepository.findOne({ where: { userId, itemId } });
    if (!itemPermission) {
      throw new Error('Permission not found');
    }
    await this.permissionRepository.remove(itemPermission);
    return true;
  }

  async revokeBucketPermission(userId: any, bucketId: string): Promise<boolean> {
    const bucketPermission = await this.permissionRepository.findOne({ where: { userId, bucketId } });
    if (!bucketPermission) {
      throw new Error('Permission not found');
    }
    await this.permissionRepository.remove(bucketPermission);
    return true;
  }
}
