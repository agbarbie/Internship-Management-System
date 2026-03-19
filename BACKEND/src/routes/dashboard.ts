import { Router } from 'express';
import {
  getStats,
  getActivity,
  getNotifications,
  markNotificationsRead,
} from '../controllers/dashboard.controller';
import authMiddleware from '../middleware/auth';

const router = Router();

router.get('/stats',               authMiddleware, getStats);
router.get('/activity',            authMiddleware, getActivity);
router.get('/notifications',       authMiddleware, getNotifications);
router.patch('/notifications/read',authMiddleware, markNotificationsRead);

export default router;