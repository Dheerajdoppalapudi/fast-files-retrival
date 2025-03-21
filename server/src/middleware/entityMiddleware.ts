import { Request, Response, NextFunction, RequestHandler } from 'express';
import { getRepository } from 'typeorm';
import { Bucket } from '../models/Bucket';
import { MyItem } from '../models/Myitem';
import { Permission } from '../models/Permission';
import { ObjectVersion } from '../models/ObjectVersion';
import { Approver } from '../models/Approver';
import { AuthRequest } from './authMiddleware'; // Import your existing auth type
import { asyncHandler } from './authMiddleware'; // Import your existing async handler

// Error response helper
const errorResponse = (res: Response, status: number, message: string) => {
  return res.status(status).json({ success: false, message });
};

// Base validator class for shared functionality
class BaseValidator {
  protected async checkPermission(userId: string, resourceType: string, resourceId: string, requiredPermission: string): Promise<boolean> {
    const permissionRepo = getRepository(Permission);
    
    const permission = await permissionRepo.findOne({
      where: {
        userId,
        [`${resourceType}Id`]: resourceId,
        permissionType: requiredPermission
      }
    });

    return !!permission;
  }

  protected async isResourceOwner(userId: string, resource: any): Promise<boolean> {
    return resource && resource.userId === userId;
  }
}

// Bucket validation
export class BucketValidator extends BaseValidator {
  static validateBucketAccess = (permission: string = 'read'): RequestHandler => {
    return asyncHandler<AuthRequest>(async (req, res, next) => {
      try {
        const { bucketId } = req.params;
        const userId = req.user?.id;

        if (!bucketId) {
          return errorResponse(res, 400, 'Bucket ID is required');
        }

        if (!userId) {
          return errorResponse(res, 401, 'Authentication required');
        }

        const bucketRepo = getRepository(Bucket);
        const bucket = await bucketRepo.findOne({ where: { id: bucketId } });

        if (!bucket) {
          return errorResponse(res, 404, 'Bucket not found');
        }

        const validator = new BucketValidator();
        const isOwner = await validator.isResourceOwner(userId, bucket);
        const hasPermission = await validator.checkPermission(userId, 'bucket', bucketId, permission);

        // Allow access if user is owner or has required permission
        if (isOwner || hasPermission || req.user?.role === 'admin') {
          // Attach bucket to request for later use
          (req as any).bucket = bucket;
          next();
        }

        return errorResponse(res, 403, `Access denied: Insufficient permissions for bucket operation`);
      } catch (error) {
        console.error('Bucket validation error:', error);
        return errorResponse(res, 500, 'Server error during bucket validation');
      }
    });
  }
}

// Item validation
export class ItemValidator extends BaseValidator {
  static validateItemAccess = (permission: string = 'read'): RequestHandler => {
    return asyncHandler<AuthRequest>(async (req, res, next) => {
      try {
        const { itemId } = req.params;
        const userId = req.user?.id;

        if (!itemId) {
          return errorResponse(res, 400, 'Item ID is required');
        }

        if (!userId) {
          return errorResponse(res, 401, 'Authentication required');
        }

        const itemRepo = getRepository(MyItem);
        const item = await itemRepo.findOne({ 
          where: { id: itemId },
          relations: ['bucket'] 
        });

        if (!item) {
          return errorResponse(res, 404, 'Item not found');
        }

        const validator = new ItemValidator();
        const isOwner = await validator.isResourceOwner(userId, item);
        const hasItemPermission = await validator.checkPermission(userId, 'item', itemId, permission);
        const hasBucketPermission = await validator.checkPermission(userId, 'bucket', item.bucketId, permission);

        // Allow access if user is owner, has item permission, or has bucket permission
        if (isOwner || hasItemPermission || hasBucketPermission || req.user?.role === 'admin') {
          // Attach item to request for later use
          (req as any).item = item;
          return next();
        }

        return errorResponse(res, 403, `Access denied: Insufficient permissions for item operation`);
      } catch (error) {
        console.error('Item validation error:', error);
        return errorResponse(res, 500, 'Server error during item validation');
      }
    });
  }
}

// Object Version validation
export class VersionValidator extends BaseValidator {
  static validateVersionAccess = (): RequestHandler => {
    return asyncHandler<AuthRequest>(async (req, res, next) => {
      try {
        const { versionId } = req.params;
        const userId = req.user?.id;

        if (!versionId) {
          return errorResponse(res, 400, 'Version ID is required');
        }

        if (!userId) {
          return errorResponse(res, 401, 'Authentication required');
        }

        const versionRepo = getRepository(ObjectVersion);
        const version = await versionRepo.findOne({
          where: { id: versionId },
          relations: ['object', 'object.bucket']
        });

        if (!version) {
          return errorResponse(res, 404, 'Version not found');
        }

        const validator = new VersionValidator();
        const isUploader = version.userId === userId;
        const hasItemPermission = await validator.checkPermission(userId, 'item', version.objectId, 'read');
        const hasBucketPermission = await validator.checkPermission(userId, 'bucket', version.object.bucketId, 'read');

        if (isUploader || hasItemPermission || hasBucketPermission || req.user?.role === 'admin') {
          // Attach version to request for later use
          (req as any).version = version;
          return next();
        }

        return errorResponse(res, 403, 'Access denied: Insufficient permissions for version access');
      } catch (error) {
        console.error('Version validation error:', error);
        return errorResponse(res, 500, 'Server error during version validation');
      }
    });
  }
}

// Approval validation
export class ApprovalValidator extends BaseValidator {
  static validateApproverAccess = (): RequestHandler => {
    return asyncHandler<AuthRequest>(async (req, res, next) => {
      try {
        const { approverId } = req.params;
        const userId = req.user?.id;
        
        if (!approverId) {
          return errorResponse(res, 400, 'Approver ID is required');
        }
        
        if (!userId) {
          return errorResponse(res, 401, 'Authentication required');
        }
        
        const approverRepo = getRepository(Approver);
        const approver = await approverRepo.findOne({
          where: { id: approverId },
          relations: ['users']
        });
        
        if (!approver) {
          return errorResponse(res, 404, 'Approver not found');
        }
        
        // Check if user is part of the approver group
        const isApprover = approver.users.some(user => user.id === userId);
        
        if (isApprover || req.user?.role === 'admin') {
          (req as any).approver = approver;
          return next();
        }
        
        return errorResponse(res, 403, 'Access denied: You are not authorized as an approver');
      } catch (error) {
        console.error('Approver validation error:', error);
        return errorResponse(res, 500, 'Server error during approver validation');
      }
    });
  }
}

// Validation for parent-child bucket relationships
export class HierarchyValidator extends BaseValidator {
  static validateParentBucketAccess = (permission: string = 'read'): RequestHandler => {
    return asyncHandler<AuthRequest>(async (req, res, next) => {
      try {
        const { parentId } = req.params;
        const userId = req.user?.id;

        if (!parentId) {
          return errorResponse(res, 400, 'Parent Bucket ID is required');
        }

        if (!userId) {
          return errorResponse(res, 401, 'Authentication required');
        }

        const bucketRepo = getRepository(Bucket);
        const parentBucket = await bucketRepo.findOne({ where: { id: parentId } });

        if (!parentBucket) {
          return errorResponse(res, 404, 'Parent Bucket not found');
        }

        const validator = new HierarchyValidator();
        const isOwner = await validator.isResourceOwner(userId, parentBucket);
        const hasPermission = await validator.checkPermission(userId, 'bucket', parentId, permission);

        if (isOwner || hasPermission || req.user?.role === 'admin') {
          (req as any).parentBucket = parentBucket;
          return next();
        }

        return errorResponse(res, 403, 'Access denied: Insufficient permissions for parent bucket');
      } catch (error) {
        console.error('Parent bucket validation error:', error);
        return errorResponse(res, 500, 'Server error during parent bucket validation');
      }
    });
  }
}

// Validation for item operations that require a specific bucket context
export class BucketItemValidator extends BaseValidator {
  static validateBucketItemCreation = (): RequestHandler => {
    return asyncHandler<AuthRequest>(async (req, res, next) => {
      try {
        const { bucketId } = req.params;
        const userId = req.user?.id;

        if (!bucketId) {
          return errorResponse(res, 400, 'Bucket ID is required');
        }

        if (!userId) {
          return errorResponse(res, 401, 'Authentication required');
        }

        const bucketRepo = getRepository(Bucket);
        const bucket = await bucketRepo.findOne({ where: { id: bucketId } });

        if (!bucket) {
          return errorResponse(res, 404, 'Bucket not found');
        }

        const validator = new BucketItemValidator();
        const isOwner = await validator.isResourceOwner(userId, bucket);
        const hasPermission = await validator.checkPermission(userId, 'bucket', bucketId, 'write');

        if (isOwner || hasPermission || req.user?.role === 'admin') {
          (req as any).bucket = bucket;
          return next();
        }

        return errorResponse(res, 403, 'Access denied: Insufficient permissions to create items in this bucket');
      } catch (error) {
        console.error('Bucket-item validation error:', error);
        return errorResponse(res, 500, 'Server error during bucket-item validation');
      }
    });
  }
}

// Middleware factory for common validation operations
export const validateAccess = {
  bucket: (permission: string = 'read') => BucketValidator.validateBucketAccess(permission),
  item: (permission: string = 'read') => ItemValidator.validateItemAccess(permission),
  version: () => VersionValidator.validateVersionAccess(),
  approver: () => ApprovalValidator.validateApproverAccess(),
  parentBucket: (permission: string = 'read') => HierarchyValidator.validateParentBucketAccess(permission),
  bucketItemCreation: () => BucketItemValidator.validateBucketItemCreation(),
  
  // Admin check using the existing pattern but with asyncHandler for consistency
  admin: asyncHandler<AuthRequest>(async (req, res, next) => {
    if (req.user?.role !== 'admin') {
      return errorResponse(res, 403, 'Admin access required');
    }
    next();
  })
};

export default validateAccess;