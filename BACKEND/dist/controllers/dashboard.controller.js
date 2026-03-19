"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markNotificationsRead = exports.getNotifications = exports.getActivity = exports.getStats = void 0;
const db_1 = __importDefault(require("../db"));
// ── GET STATS ─────────────────────────────────────────────────
const getStats = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (role === 'intern') {
            const stats = await db_1.default.query('SELECT * FROM v_dashboard_stats WHERE user_id = $1', [userId]);
            const profile = await db_1.default.query(`SELECT ip.overall_score, ip.start_date, ip.end_date,
                ip.university, ip.course,
                u.first_name || ' ' || u.last_name AS supervisor_name
         FROM intern_profiles ip
         LEFT JOIN users u ON u.id = ip.supervisor_id
         WHERE ip.user_id = $1`, [userId]);
            res.json({ stats: stats.rows[0], profile: profile.rows[0] });
        }
        else {
            const stats = await db_1.default.query('SELECT * FROM v_dashboard_stats ORDER BY total_tasks DESC');
            const overview = await db_1.default.query('SELECT * FROM v_intern_overview ORDER BY overall_score DESC');
            res.json({ stats: stats.rows, overview: overview.rows });
        }
    }
    catch (err) {
        console.error('Dashboard stats error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
};
exports.getStats = getStats;
// ── GET ACTIVITY ──────────────────────────────────────────────
const getActivity = async (req, res) => {
    try {
        const result = await db_1.default.query(`SELECT al.action, al.entity_type, al.meta, al.created_at,
              u.first_name || ' ' || u.last_name AS user_name
       FROM activity_log al
       JOIN users u ON u.id = al.user_id
       WHERE al.user_id = $1
       ORDER BY al.created_at DESC LIMIT 10`, [req.user?.id]);
        res.json(result.rows);
    }
    catch (err) {
        console.error('Activity error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
};
exports.getActivity = getActivity;
// ── GET NOTIFICATIONS ─────────────────────────────────────────
const getNotifications = async (req, res) => {
    try {
        const result = await db_1.default.query(`SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [req.user?.id]);
        res.json(result.rows);
    }
    catch (err) {
        console.error('Notifications error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
};
exports.getNotifications = getNotifications;
// ── MARK NOTIFICATIONS READ ───────────────────────────────────
const markNotificationsRead = async (req, res) => {
    try {
        await db_1.default.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.user?.id]);
        res.json({ message: 'All notifications marked as read.' });
    }
    catch (err) {
        console.error('Notifications read error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
};
exports.markNotificationsRead = markNotificationsRead;
