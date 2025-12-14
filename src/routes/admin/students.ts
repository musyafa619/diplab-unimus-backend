import { Router } from 'express';
import {
  createStudent,
  listStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
} from '../../controllers/studentController';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

// protect student endpoints
router.use(authMiddleware);

router.post('/', createStudent);
router.get('/', listStudents);
router.get('/:id', getStudentById);
router.put('/:id', updateStudent);
router.delete('/:id', deleteStudent);

export default router;
