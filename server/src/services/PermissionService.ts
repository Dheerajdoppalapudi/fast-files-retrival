import { AppDataSource } from '../config/db';
import { Permission } from '../models/Permission';
import { User } from '../models/userModel';

export class PermissionService {
  private permissionRepository = AppDataSource.getRepository(Permission);
  private userRepository = AppDataSource.getRepository(User);

  async isAdmin(userId: any): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return user?.role === 'admin';
  }

  async hasBucketPermission(userId: any, bucketId: string, permissionType: string = 'write'): Promise<boolean> {
    if (await this.isAdmin(userId)) return true;
    const bucketPermission = await this.permissionRepository.findOne({ where: { userId, bucketId, permissionType } });
    return !!bucketPermission;
  }

  async getBucketPermissions(bucketId: string): Promise<Permission[]> {
    return await this.permissionRepository.find({ where: { bucketId }, relations: ['user'] });
  }

  async hasItemPermission(userId: any, itemId: string, permissionType: string = 'write'): Promise<boolean> {
    if (await this.isAdmin(userId)) return true;
    const itemPermission = await this.permissionRepository.findOne({ where: { userId, itemId, permissionType } });
    return !!itemPermission;
  }

  async getItemPermissions(itemId: string): Promise<Permission[]> {
    return await this.permissionRepository.find({ where: { itemId }, relations: ['user'] });
  }

  async assignItemPermission(userId: any, itemId?: string, permissionType: string = 'write'): Promise<Permission> {
    if (await this.isAdmin(userId)) throw new Error('Admin already has full permissions');
    if (!itemId) throw new Error('itemId must be provided');
    
    const existingPermission = await this.permissionRepository.findOne({ where: { itemId, userId } });
    if (existingPermission) {
      if (existingPermission.permissionType !== permissionType) {
        existingPermission.permissionType = permissionType;
        return await this.permissionRepository.save(existingPermission);
      }
      throw new Error('User already has this permission');
    }

    const permission = this.permissionRepository.create({ userId, itemId, permissionType });
    return await this.permissionRepository.save(permission);
  }

  async assignBucketPermission(userId: any, bucketId?: string, permissionType: string = 'write'): Promise<Permission> {
    if (await this.isAdmin(userId)) throw new Error('Admin already has full permissions');
    if (!bucketId) throw new Error('bucketId must be provided');
    
    const existingPermission = await this.permissionRepository.findOne({ where: { bucketId, userId } });
    if (existingPermission) {
      if (existingPermission.permissionType !== permissionType) {
        existingPermission.permissionType = permissionType;
        return await this.permissionRepository.save(existingPermission);
      }
      throw new Error('User already has this permission');
    }

    const permission = this.permissionRepository.create({ userId, bucketId, permissionType,inherited:true });
    return await this.permissionRepository.save(permission);
  }

  async revokeItemPermission(userId: any, itemId: string): Promise<boolean> {
    if (await this.isAdmin(userId)) throw new Error('Admin cannot have permissions revoked');
    
    const itemPermission = await this.permissionRepository.findOne({ where: { userId, itemId } });
    if (!itemPermission) throw new Error('Permission not found');
    
    await this.permissionRepository.remove(itemPermission);
    return true;
  }

  async revokeBucketPermission(userId: any, bucketId: string): Promise<boolean> {
    if (await this.isAdmin(userId)) throw new Error('Admin cannot have permissions revoked');
    
    const bucketPermission = await this.permissionRepository.findOne({ where: { userId, bucketId } });
    if (!bucketPermission) throw new Error('Permission not found');
    
    await this.permissionRepository.remove(bucketPermission);
    return true;
  }


  
}
