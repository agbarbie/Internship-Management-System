import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/auth';

// ── GET ALL TASKS ─────────────────────────────────────────────
export const getTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const role   = req.user?.role;
    const { status, category, priority } = req.query;

    let query = `
      SELECT t.*,
             assignee.first_name || ' ' || assignee.last_name AS intern_name,
             assigner.first_name || ' ' || assigner.last_name AS supervisor_name,
             p.name AS project_name,
             COUNT(ts.id)  AS submission_count,
             COUNT(fa.id)  AS file_count
      FROM tasks t
      JOIN users assignee ON assignee.id = t.assigned_to
      JOIN users assigner ON assigner.id = t.assigned_by
      LEFT JOIN projects p           ON p.id  = t.project_id
      LEFT JOIN task_submissions ts  ON ts.task_id = t.id
      LEFT JOIN file_attachments fa  ON fa.submission_id = ts.id
    `;

    const conditions: string[] = [];
    const params: any[]        = [];
    let   paramCount           = 1;

    if (role === 'intern') {
      conditions.push(`t.assigned_to = $${paramCount++}`);
      params.push(userId);
    } else {
      conditions.push(`t.assigned_by = $${paramCount++}`);
      params.push(userId);
    }

    if (status)   { conditions.push(`t.status   = $${paramCount++}`); params.push(status);   }
    if (category) { conditions.push(`t.category = $${paramCount++}`); params.push(category); }
    if (priority) { conditions.push(`t.priority = $${paramCount++}`); params.push(priority); }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' GROUP BY t.id, assignee.first_name, assignee.last_name, assigner.first_name, assigner.last_name, p.name';
    query += ' ORDER BY t.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('Get tasks error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ── GET SINGLE TASK ───────────────────────────────────────────
export const getTaskById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const taskResult = await pool.query(
      `SELECT t.*,
              assignee.first_name || ' ' || assignee.last_name AS intern_name,
              assigner.first_name || ' ' || assigner.last_name AS supervisor_name,
              p.name AS project_name
       FROM tasks t
       JOIN users assignee ON assignee.id = t.assigned_to
       JOIN users assigner ON assigner.id = t.assigned_by
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (taskResult.rows.length === 0) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    const submissions = await pool.query(
      `SELECT ts.*,
              array_agg(json_build_object(
                'id', fa.id, 'file_name', fa.file_name,
                'file_size_kb', fa.file_size_kb, 'file_type', fa.file_type
              )) AS files
       FROM task_submissions ts
       LEFT JOIN file_attachments fa ON fa.submission_id = ts.id
       WHERE ts.task_id = $1
       GROUP BY ts.id
       ORDER BY ts.submitted_at DESC`,
      [req.params.id]
    );

    const feedback = await pool.query(
      `SELECT f.*, u.first_name || ' ' || u.last_name AS given_by_name
       FROM feedback f
       JOIN users u ON u.id = f.given_by
       WHERE f.task_id = $1
       ORDER BY f.created_at DESC`,
      [req.params.id]
    );

    res.json({ task: taskResult.rows[0], submissions: submissions.rows, feedback: feedback.rows });
  } catch (err: any) {
    console.error('Get task error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ── CREATE TASK ───────────────────────────────────────────────
export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, description, category, priority, assigned_to, project_id, due_date, tags } = req.body;

  if (!title || !category || !assigned_to) {
    res.status(400).json({ error: 'Title, category and assigned_to are required.' });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO tasks (title, description, category, priority, assigned_to, assigned_by, project_id, due_date, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [title, description, category, priority || 'medium', assigned_to, req.user?.id, project_id, due_date, tags]
    );

    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, link)
       VALUES ($1, 'task_assigned', 'New Task Assigned', $2, $3)`,
      [assigned_to, `New task assigned: ${title}`, `/tasks/${result.rows[0].id}`]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Create task error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ── SUBMIT TASK ───────────────────────────────────────────────
export const submitTask = async (req: AuthRequest, res: Response): Promise<void> => {
  const { content, progress_pct, submission_type } = req.body;

  try {
    await pool.query(
      `UPDATE tasks SET status = 'submitted', submitted_at = NOW(),
       progress_pct = $1, updated_at = NOW() WHERE id = $2`,
      [progress_pct || 100, req.params.id]
    );

    const submission = await pool.query(
      `INSERT INTO task_submissions (task_id, submitted_by, content, progress_pct, submission_type)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, req.user?.id, content, progress_pct || 100, submission_type || 'initial']
    );

    await pool.query(
      `INSERT INTO activity_log (user_id, action, entity_type, entity_id, meta)
       VALUES ($1, 'task_submitted', 'task', $2, $3)`,
      [req.user?.id, req.params.id, JSON.stringify({ submission_type: submission_type || 'initial' })]
    );

    const task = await pool.query('SELECT assigned_by, title FROM tasks WHERE id = $1', [req.params.id]);
    if (task.rows.length > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ($1, 'task_submitted', 'Task Submitted for Review', $2, $3)`,
        [task.rows[0].assigned_by, `${task.rows[0].title} has been submitted for review.`, `/tasks/${req.params.id}`]
      );
    }

    res.status(201).json(submission.rows[0]);
  } catch (err: any) {
    console.error('Submit task error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ── REVIEW TASK ───────────────────────────────────────────────
export const reviewTask = async (req: AuthRequest, res: Response): Promise<void> => {
  const { action, rating, comment } = req.body;

  if (!action || !['approve', 'revision', 'reject'].includes(action)) {
    res.status(400).json({ error: 'Action must be approve, revision, or reject.' });
    return;
  }

  try {
    if (action === 'approve') {
      await pool.query('SELECT approve_task($1, $2, $3, $4)', [
        req.params.id, req.user?.id, rating || 5, comment,
      ]);
    } else if (action === 'revision') {
      await pool.query('SELECT request_revision($1, $2, $3)', [
        req.params.id, req.user?.id, comment,
      ]);
    } else {
      await pool.query(
        `UPDATE tasks SET status = 'rejected', reviewed_at = NOW(),
         supervisor_notes = $1, updated_at = NOW() WHERE id = $2`,
        [comment, req.params.id]
      );
    }
    res.json({ message: `Task ${action}d successfully.` });
  } catch (err: any) {
    console.error('Review task error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ── GET TASK FILES ────────────────────────────────────────────
export const getTaskFiles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT fa.* FROM file_attachments fa
       JOIN task_submissions ts ON ts.id = fa.submission_id
       WHERE ts.task_id = $1
       ORDER BY fa.uploaded_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Get files error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
};