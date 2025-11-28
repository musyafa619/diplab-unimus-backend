import { Router } from 'express';
import os from 'os';
import multer from 'multer';
import {
  createItem,
  listItems,
  getItemById,
  updateItem,
  deleteItem,
} from '../controllers/itemController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// multer that stores uploads temporarily in OS temp dir
// limit file uploads to 5 MB
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// protect all item routes
router.use(authMiddleware);

// POST /api/items (accepts file field `image`)
router.post('/', upload.single('image'), createItem);

// GET /api/items
router.get('/', listItems);

// GET /api/items/:id
router.get('/:id', getItemById);

// PUT /api/items/:id (accepts file field `image`)
router.put('/:id', upload.single('image'), updateItem);

// DELETE /api/items/:id
router.delete('/:id', deleteItem);

export default router;
