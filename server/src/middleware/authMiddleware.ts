// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/UserRepository';
import { UserResponse } from '../repositories/UserRepository';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Extend the Request interface to include the user property
export interface AuthRequest extends Request {
  user?: UserResponse;
}

// Middleware to authenticate JWT token
export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN format

  // Check if token exists
  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Access token required' });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };

    // Fetch the user from the database
    const userRepository = new UserRepository();
    const user = await userRepository.findById(decoded.id);

    // Check if user exists
    if (!user) {
      return res.status(403).json({ status: 'error', message: 'Invalid token' });
    }

    // Attach the user to the request (without password)
    req.user = userRepository.toResponse(user);
    next();
  } catch (error) {
    return res.status(403).json({ status: 'error', message: 'Invalid or expired token' });
  }
};

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