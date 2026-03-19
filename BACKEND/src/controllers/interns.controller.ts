import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/auth';

// ── GET ALL INTERNS ───────────────────────────────────────────
export const getInterns = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT * FROM v_intern_overview ORDER BY overall_score DESC');
    res.json(result.rows);
  } catch (err: any) {
    console.error('Get interns error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ── GET SINGLE INTERN ─────────────────────────────────────────
export const getInternById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const intern = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
              u.bio, u.skills, u.avatar_url, u.created_at,
              o.name AS organization, d.name AS department,
              ip.overall_score, ip.tasks_completed, ip.tasks_total,
              ip.start_date, ip.end_date, ip.university, ip.course,
              ip.graduation_year,
              sup.first_name || ' ' || sup.last_name AS supervisor_name
       FROM users u
       JOIN intern_profiles ip ON ip.user_id = u.id
       LEFT JOIN organizations o   ON o.id  = u.organization_id
       LEFT JOIN departments   d   ON d.id  = u.department_id
       LEFT JOIN users         sup ON sup.id = ip.supervisor_id
       WHERE u.id = $1 AND u.role = 'intern'`,
      [req.params.id]
    );

    if (intern.rows.length === 0) {
      res.status(404).json({ error: 'Intern not found.' });
      return;
    }

    const tasks = await pool.query(
      `SELECT * FROM v_task_summary
       WHERE intern_name = (SELECT first_name || ' ' || last_name FROM users WHERE id = $1)
       ORDER BY due_date DESC`,
      [req.params.id]
    );

    const feedback = await pool.query(
      `SELECT f.rating, f.comment, f.created_at,
              u.first_name || ' ' || u.last_name AS given_by,
              t.title AS task_title
       FROM feedback f
       JOIN users u ON u.id = f.given_by
       JOIN tasks t ON t.id = f.task_id
       WHERE f.given_to = $1
       ORDER BY f.created_at DESC`,
      [req.params.id]
    );

    res.json({ intern: intern.rows[0], tasks: tasks.rows, feedback: feedback.rows });
  } catch (err: any) {
    console.error('Get intern error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
};