import { Router } from 'express';
import {
  getTasks,
  getTaskById,
  createTask,
  submitTask,
  reviewTask,
  getTaskFiles,
} from '../controllers/tasks.controller';
import authMiddleware from '../middleware/auth';

const router = Router();

router.get('/',             authMiddleware, getTasks);
router.get('/:id',          authMiddleware, getTaskById);
router.post('/',            authMiddleware, createTask);
router.post('/:id/submit',  authMiddleware, submitTask);
router.patch('/:id/review', authMiddleware, reviewTask);
router.get('/:id/files',    authMiddleware, getTaskFiles);

export default router;