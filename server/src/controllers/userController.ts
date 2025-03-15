import { Request, Response, NextFunction } from 'express';
import UserService from '../services/userService';
import { AuthRequest } from '../middleware/authMiddleware';

// Get user by ID
export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.params.id;

    // Call the service to get user data
    const user = await UserService.getUserById(userId);

    // Send the response
    res.status(200).json(user);
  } catch (error) {
    next(error); // Pass the error to the error handler middleware
  }
};

export const searchUser = async (req: AuthRequest, res: Response) => {

  try {

    const {search}=req.params;


    const listUser=await UserService.searchUser(search);
    res.status(200).json(listUser);

    
  } catch (error) {
    next(error); // P
  }


}