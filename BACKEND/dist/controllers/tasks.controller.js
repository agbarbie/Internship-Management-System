"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTaskFiles = exports.reviewTask = exports.submitTask = exports.createTask = exports.getTaskById = exports.getTasks = void 0;
const db_1 = __importDefault(require("../db"));
// ── GET ALL TASKS ─────────────────────────────────────────────
const getTasks = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        const { status, category, priority } = req.query;
        let query = `
      SELECT t.*,
             assignee.first_name || ' ' || assignee.last_name AS intern_name,
             assigner.first_name || ' ' || assigner.last_name AS supervisor_name,
             p.name AS project_name,
             COUNT(DISTINCT ts.id)  AS submission_count,
             COUNT(DISTINCT fa.id)  AS file_count
      FROM tasks t
      JOIN users assignee ON assignee.id = t.assigned_to
      JOIN users assigner ON assigner.id = t.assigned_by
      LEFT JOIN projects p           ON p.id  = t.project_id
      LEFT JOIN task_submissions ts  ON ts.task_id = t.id
      LEFT JOIN file_attachments fa  ON fa.submission_id = ts.id
    `;
        const conditions = [];
        const params = [];
        let paramCount = 1;
        if (role === 'intern') {
            conditions.push(`t.assigned_to = $${paramCount++}`);
            params.push(userId);
        }
        else {
            conditions.push(`t.assigned_by = $${paramCount++}`);
            params.push(userId);
        }
        if (status) {
            conditions.push(`t.status   = $${paramCount++}`);
            params.push(status);
        }
        if (category) {
            conditions.push(`t.category = $${paramCount++}`);
            params.push(category);
        }
        if (priority) {
            conditions.push(`t.priority = $${paramCount++}`);
            params.push(priority);
        }
        if (conditions.length > 0)
            query += ' WHERE ' + conditions.join(' AND ');
        query += ' GROUP BY t.id, assignee.first_name, assignee.last_name, assigner.first_name, assigner.last_name, p.name';
        query += ' ORDER BY t.created_at DESC';
        const result = await db_1.default.query(query, params);
        res.json(result.rows);
    }
    catch (err) {
        console.error('Get tasks error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
};
exports.getTasks = getTasks;
// ── GET SINGLE TASK ───────────────────────────────────────────
const getTaskById = async (req, res) => {
    try {
        const taskResult = await db_1.default.query(`SELECT t.*,
              assignee.first_name || ' ' || assignee.last_name AS intern_name,
              assigner.first_name || ' ' || assigner.last_name AS supervisor_name,
              p.name AS project_name
       FROM tasks t
       JOIN users assignee ON assignee.id = t.assigned_to
       JOIN users assigner ON assigner.id = t.assigned_by
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.id = $1`, [req.params.id]);
        if (taskResult.rows.length === 0) {
            res.status(404).json({ error: 'Task not found.' });
            return;
        }
        const submissions = await db_1.default.query(`SELECT ts.*,
              COALESCE(
                array_agg(
                  json_build_object(
                    'id', fa.id, 'file_name', fa.file_name,
                    'file_size_kb', fa.file_size_kb, 'file_type', fa.file_type
                  )
                ) FILTER (WHERE fa.id IS NOT NULL),
                '{}'
              ) AS files
       FROM task_submissions ts
       LEFT JOIN file_attachments fa ON fa.submission_id = ts.id
       WHERE ts.task_id = $1
       GROUP BY ts.id
       ORDER BY ts.submitted_at DESC`, [req.params.id]);
        const feedback = await db_1.default.query(`SELECT f.*, u.first_name || ' ' || u.last_name AS given_by_name
       FROM feedback f
       JOIN users u ON u.id = f.given_by
       WHERE f.task_id = $1
       ORDER BY f.created_at DESC`, [req.params.id]);
        res.json({ task: taskResult.rows[0], submissions: submissions.rows, feedback: feedback.rows });
    }
    catch (err) {
        console.error('Get task error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
};
exports.getTaskById = getTaskById;
// ── CREATE TASK ───────────────────────────────────────────────
const createTask = async (req, res) => {
    const { title, description, category, priority, assigned_to, project_id, due_date, tags } = req.body;
    if (!title || !category || !assigned_to) {
        res.status(400).json({ error: 'Title, category and assigned_to are required.' });
        return;
    }
    try {
        const result = await db_1.default.query(`INSERT INTO tasks (title, description, category, priority, assigned_to, assigned_by, project_id, due_date, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`, [title, description, category, priority || 'medium', assigned_to, req.user?.id, project_id || null, due_date || null, tags || null]);
        // Notify the assigned intern
        await db_1.default.query(`INSERT INTO notifications (user_id, type, title, message, link)
       VALUES ($1, 'task_assigned', 'New Task Assigned', $2, $3)`, [assigned_to, `New task assigned: ${title}`, `/tasks/${result.rows[0].id}`]).catch(e => console.warn('Notification insert failed (non-fatal):', e.message));
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error('Create task error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
};
exports.createTask = createTask;
// ── SUBMIT TASK ───────────────────────────────────────────────
// FIX: wrapped in a transaction so a failure in activity_log or
//      notifications doesn't roll back the actual submission.
//      Also validates that the task belongs to the requesting intern.
const submitTask = async (req, res) => {
    const taskId = req.params.id;
    const userId = req.user?.id;
    const { content, progress_pct, submission_type } = req.body;
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        // ── Validate: task must exist and be assigned to this intern ──
        const taskCheck = await client.query(`SELECT id, assigned_by, title, status, assigned_to
       FROM tasks WHERE id = $1`, [taskId]);
        if (taskCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({ error: 'Task not found.' });
            return;
        }
        const task = taskCheck.rows[0];
        if (task.assigned_to !== userId) {
            await client.query('ROLLBACK');
            res.status(403).json({ error: 'You can only submit tasks assigned to you.' });
            return;
        }
        // ── Update task status ────────────────────────────────────
        await client.query(`UPDATE tasks
       SET status       = 'submitted',
           submitted_at = NOW(),
           progress_pct = $1,
           updated_at   = NOW()
       WHERE id = $2`, [progress_pct ?? 100, taskId]);
        // ── Insert submission row ─────────────────────────────────
        const submission = await client.query(`INSERT INTO task_submissions
         (task_id, submitted_by, content, progress_pct, submission_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`, [taskId, userId, content || '', progress_pct ?? 100, submission_type || 'initial']);
        await client.query('COMMIT');
        // ── Non-critical: activity log + notification ─────────────
        // These run AFTER commit so a failure here never causes a 500
        db_1.default.query(`INSERT INTO activity_log (user_id, action, entity_type, entity_id, meta)
       VALUES ($1, 'task_submitted', 'task', $2, $3)`, [userId, taskId, JSON.stringify({ submission_type: submission_type || 'initial' })]).catch(e => console.warn('activity_log insert failed (non-fatal):', e.message));
        db_1.default.query(`INSERT INTO notifications (user_id, type, title, message, link)
       VALUES ($1, 'task_submitted', 'Task Submitted for Review', $2, $3)`, [task.assigned_by, `${task.title} has been submitted for review.`, `/tasks/${taskId}`]).catch(e => console.warn('Notification insert failed (non-fatal):', e.message));
        res.status(201).json(submission.rows[0]);
    }
    catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        console.error('Submit task error:', err.message, err.stack);
        res.status(500).json({ error: err.message || 'Server error. Could not submit task.' });
    }
    finally {
        client.release();
    }
};
exports.submitTask = submitTask;
// ── REVIEW TASK ───────────────────────────────────────────────
const reviewTask = async (req, res) => {
    const { action, rating, comment } = req.body;
    if (!action || !['approve', 'revision', 'reject'].includes(action)) {
        res.status(400).json({ error: 'Action must be approve, revision, or reject.' });
        return;
    }
    try {
        if (action === 'approve') {
            await db_1.default.query('SELECT approve_task($1, $2, $3, $4)', [
                req.params.id, req.user?.id, rating || 5, comment,
            ]);
        }
        else if (action === 'revision') {
            await db_1.default.query('SELECT request_revision($1, $2, $3)', [
                req.params.id, req.user?.id, comment,
            ]);
        }
        else {
            await db_1.default.query(`UPDATE tasks SET status = 'rejected', reviewed_at = NOW(),
         supervisor_notes = $1, updated_at = NOW() WHERE id = $2`, [comment, req.params.id]);
        }
        res.json({ message: `Task ${action}d successfully.` });
    }
    catch (err) {
        console.error('Review task error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
};
exports.reviewTask = reviewTask;
// ── GET TASK FILES ────────────────────────────────────────────
const getTaskFiles = async (req, res) => {
    try {
        const result = await db_1.default.query(`SELECT fa.* FROM file_attachments fa
       JOIN task_submissions ts ON ts.id = fa.submission_id
       WHERE ts.task_id = $1
       ORDER BY fa.uploaded_at DESC`, [req.params.id]);
        res.json(result.rows);
    }
    catch (err) {
        console.error('Get files error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
};
exports.getTaskFiles = getTaskFiles;
