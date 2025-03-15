import { Router } from 'express';
import { AuthRequest, authenticateToken, authorizeRole } from '../middleware/authMiddleware';
import { Response } from 'express';
import { UserRepository } from '../repositories/UserRepository';
import { searchUser } from '../controllers/userController';

const router = Router();

// Get current user profile
router.get('/profile', authenticateToken, (req: AuthRequest, res: Response) => {
  res.json({
    status: 'success',
    user: req.user
  });
});


router.get('/search/:search', authenticateToken,searchUser )


export default router;