import { Router } from 'express';
import {
  createAdmin,
  login,
  getMe,
  logout,
} from '../../controllers/adminController';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

// POST /api/admins/create - create new admin
router.post('/create', createAdmin);

// POST /api/admins/login - login and set JWT cookie
router.post('/login', login);

// GET /api/admins/me - return current admin from cookie
router.get('/me', authMiddleware, getMe);

// POST /api/admins/logout - clear jwt cookie
router.post('/logout', authMiddleware, logout);

export default router;
