import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/auth';

// ── GET STATS ─────────────────────────────────────────────────
export const getStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const role   = req.user?.role;

    if (role === 'intern') {
      const stats = await pool.query(
        'SELECT * FROM v_dashboard_stats WHERE user_id = $1', [userId]
      );
      const profile = await pool.query(
        `SELECT ip.overall_score, ip.start_date, ip.end_date,
                ip.university, ip.course,
                u.first_name || ' ' || u.last_name AS supervisor_name
         FROM intern_profiles ip
         LEFT JOIN users u ON u.id = ip.supervisor_id
         WHERE ip.user_id = $1`,
        [userId]
      );
      res.json({ stats: stats.rows[0], profile: profile.rows[0] });
    } else {
      const stats    = await pool.query('SELECT * FROM v_dashboard_stats ORDER BY total_tasks DESC');
      const overview = await pool.query('SELECT * FROM v_intern_overview ORDER BY overall_score DESC');
      res.json({ stats: stats.rows, overview: overview.rows });
    }
  } catch (err: any) {
    console.error('Dashboard stats error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ── GET ACTIVITY ──────────────────────────────────────────────
export const getActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT al.action, al.entity_type, al.meta, al.created_at,
              u.first_name || ' ' || u.last_name AS user_name
       FROM activity_log al
       JOIN users u ON u.id = al.user_id
       WHERE al.user_id = $1
       ORDER BY al.created_at DESC LIMIT 10`,
      [req.user?.id]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Activity error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ── GET NOTIFICATIONS ─────────────────────────────────────────
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.user?.id]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Notifications error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ── MARK NOTIFICATIONS READ ───────────────────────────────────
export const markNotificationsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
      [req.user?.id]
    );
    res.json({ message: 'All notifications marked as read.' });
  } catch (err: any) {
    console.error('Notifications read error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
};