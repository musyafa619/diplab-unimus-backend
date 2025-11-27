import { Router } from 'express';
import {
  createAdmin,
  listAdmins,
  getAdminById,
  deleteAdmin,
  login,
  getMe,
  logout,
} from '../controllers/adminController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// POST /api/admins - create new admin
router.post('/', createAdmin);

// POST /api/admins/login - login and set JWT cookie
router.post('/login', login);

// GET /api/admins - list admins
router.get('/', listAdmins);

// GET /api/admins/me - return current admin from cookie
router.get('/me', authMiddleware, getMe);

// GET /api/admins/:id - get single admin
router.get('/:id', getAdminById);

// POST /api/admins/logout - clear jwt cookie
router.post('/logout', authMiddleware, logout);

// DELETE /api/admins/:id - delete admin
router.delete('/:id', deleteAdmin);

export default router;
