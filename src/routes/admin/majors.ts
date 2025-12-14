import { Router } from 'express';
import {
  createMajor,
  listMajors,
  getMajorById,
  updateMajor,
  deleteMajor,
} from '../../controllers/majorController';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

// protect majors endpoints
router.use(authMiddleware);

router.post('/', createMajor);
router.get('/', listMajors);
router.get('/:id', getMajorById);
router.put('/:id', updateMajor);
router.delete('/:id', deleteMajor);

export default router;
