import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/UserRepository';
import { UserResponse } from '../repositories/UserRepository';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Extend the Request interface to include the user property
export interface AuthRequest extends Request {
  user?: UserResponse;
}

// Middleware to authenticate JWT token
export const asyncHandler =
  <T extends Request = Request>(fn: (req: T, res: Response, next: NextFunction) => Promise<void>) =>
  (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const authenticateToken = asyncHandler<AuthRequest>(async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN format

  if (!token) {
    res.status(401).json({ status: 'error', message: 'Access token required' });
    return; // Ensure function returns void
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const userRepository = new UserRepository();
    const user = await userRepository.findById(decoded.id);

    if (!user) {
      res.status(403).json({ status: 'error', message: 'Invalid token' });
      return; 
    }

    req.user = userRepository.toResponse(user);
    
    // Remove this check as it's redundant - toResponse already guaranteed to return a UserResponse
    // The error is likely happening because TypeScript thinks req.user might be undefined after assignment
    next();
  } catch (error) {
    res.status(403).json({ status: 'error', message: 'Invalid or expired token' });
    return; // Ensure function returns void
  }
});


// Middleware to authorize roles
export const authorizeRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    // Check if user has the required role
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ status: 'error', message: 'Insufficient permissions' });
    }

    next();
  };
};