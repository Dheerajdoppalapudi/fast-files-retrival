import { ApiError } from '../middleware/errorMiddleware';
import initializeDB from '../config/db';
import { User } from '../models/userModel';
import { executeTransaction } from '../utils/transactionUtils';
import { ILike } from 'typeorm';

export default class UserService {
  // Get user by ID
  static async getUserById(userId: string): Promise<any> {
    // Get the singleton database connection
    const db = await initializeDB();

    // Query the database
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

    // Check if user exists
    if (!user) {
      throw new ApiError(404, 'User not found'); // Throw 404 error if user is not found
    }

    return user;
  }


  static async searchUser(search:string):Promise<any>{

     return executeTransaction(async (queryRunner) => {

      const userRepository = queryRunner.manager.getRepository(User);

      const users = await userRepository.find({
        where: [
          { username: ILike(`%${search}%`) },
          { email: ILike(`%${search}%`) },
        ],
        select: ['username', 'email'], 
      });
  
      return users;
     });

  }
}

