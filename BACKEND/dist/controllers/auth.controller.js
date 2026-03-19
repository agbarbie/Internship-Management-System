"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = exports.getMe = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jwt = __importStar(require("jsonwebtoken"));
const db_1 = __importDefault(require("../db"));
// ── REGISTER ──────────────────────────────────────────────────
const register = async (req, res) => {
    const { first_name, last_name, email, password, role, organization, department } = req.body;
    if (!first_name || !last_name || !email || !password || !role) {
        res.status(400).json({ error: 'All fields are required.' });
        return;
    }
    if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters.' });
        return;
    }
    try {
        const existing = await db_1.default.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            res.status(409).json({ error: 'An account with this email already exists.' });
            return;
        }
        const password_hash = await bcryptjs_1.default.hash(password, 12);
        // Resolve or create organization
        let org_id = null;
        if (organization) {
            const orgResult = await db_1.default.query('SELECT id FROM organizations WHERE LOWER(name) = LOWER($1)', [organization]);
            if (orgResult.rows.length > 0) {
                org_id = orgResult.rows[0].id;
            }
            else {
                const newOrg = await db_1.default.query('INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id', [organization, organization.toLowerCase().replace(/\s+/g, '-')]);
                org_id = newOrg.rows[0].id;
            }
        }
        // Resolve or create department
        let dept_id = null;
        if (department && org_id) {
            const deptResult = await db_1.default.query('SELECT id FROM departments WHERE LOWER(name) = LOWER($1) AND organization_id = $2', [department, org_id]);
            if (deptResult.rows.length > 0) {
                dept_id = deptResult.rows[0].id;
            }
            else {
                const newDept = await db_1.default.query('INSERT INTO departments (organization_id, name) VALUES ($1, $2) RETURNING id', [org_id, department]);
                dept_id = newDept.rows[0].id;
            }
        }
        const result = await db_1.default.query(`INSERT INTO users (first_name, last_name, email, password_hash, role, organization_id, department_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, first_name, last_name, email, role`, [first_name, last_name, email, password_hash, role, org_id, dept_id]);
        const user = result.rows[0];
        if (role === 'intern') {
            await db_1.default.query('INSERT INTO intern_profiles (user_id) VALUES ($1)', [user.id]);
        }
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN ?? '1h' });
        res.status(201).json({
            message: 'Account created successfully!',
            token,
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (err) {
        console.error('Register error:', err.message);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
};
exports.register = register;
// ── LOGIN ─────────────────────────────────────────────────────
const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
    }
    try {
        const result = await db_1.default.query(`SELECT u.id, u.first_name, u.last_name, u.email, u.password_hash,
              u.role, u.is_active, u.avatar_url,
              o.name AS organization, d.name AS department
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       LEFT JOIN departments   d ON d.id = u.department_id
       WHERE u.email = $1`, [email]);
        if (result.rows.length === 0) {
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }
        const user = result.rows[0];
        if (!user.is_active) {
            res.status(403).json({ error: 'Your account has been deactivated.' });
            return;
        }
        const match = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!match) {
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }
        await db_1.default.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN ?? '1h' });
        res.json({
            message: 'Login successful!',
            token,
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                role: user.role,
                organization: user.organization,
                department: user.department,
                avatar_url: user.avatar_url,
            },
        });
    }
    catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
};
exports.login = login;
// ── GET CURRENT USER ──────────────────────────────────────────
const getMe = async (req, res) => {
    try {
        const result = await db_1.default.query(`SELECT u.id, u.first_name, u.last_name, u.email, u.role,
              u.phone, u.bio, u.skills, u.avatar_url,
              o.name AS organization, d.name AS department
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       LEFT JOIN departments   d ON d.id = u.department_id
       WHERE u.id = $1`, [req.user?.id]);
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Me error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
};
exports.getMe = getMe;
// ── UPDATE PROFILE ────────────────────────────────────────────
const updateProfile = async (req, res) => {
    const { first_name, last_name, phone, bio, skills, university, course } = req.body;
    const userId = req.user?.id;
    try {
        // Update users table
        await db_1.default.query(`UPDATE users
       SET first_name  = COALESCE($1, first_name),
           last_name   = COALESCE($2, last_name),
           phone       = COALESCE($3, phone),
           bio         = COALESCE($4, bio),
           skills      = COALESCE($5, skills),
           updated_at  = NOW()
       WHERE id = $6`, [first_name || null, last_name || null, phone || null,
            bio || null, skills?.length ? skills : null, userId]);
        // Update intern_profiles if university/course provided
        if (university !== undefined || course !== undefined) {
            await db_1.default.query(`UPDATE intern_profiles
         SET university  = COALESCE($1, university),
             course      = COALESCE($2, course),
             updated_at  = NOW()
         WHERE user_id = $3`, [university || null, course || null, userId]);
        }
        // Return updated user
        const result = await db_1.default.query(`SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
              u.bio, u.skills, u.role, u.avatar_url,
              o.name AS organization, d.name AS department
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       LEFT JOIN departments   d ON d.id = u.department_id
       WHERE u.id = $1`, [userId]);
        res.json({ message: 'Profile updated successfully.', user: result.rows[0] });
    }
    catch (err) {
        console.error('Update profile error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
};
exports.updateProfile = updateProfile;
