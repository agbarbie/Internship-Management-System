import { Router } from 'express';
import { getInterns, getInternById } from '../controllers/interns.controller';
import authMiddleware from '../middleware/auth';

const router = Router();

router.get('/',    authMiddleware, getInterns);
router.get('/:id', authMiddleware, getInternById);

export default router;