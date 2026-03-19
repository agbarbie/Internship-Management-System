"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const tasks_1 = __importDefault(require("./routes/tasks"));
const interns_1 = __importDefault(require("./routes/interns"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// ── MIDDLEWARE ────────────────────────────────────
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// ── SERVE HTML PAGES ──────────────────────────────
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// ── API ROUTES ────────────────────────────────────
app.use('/api/auth', auth_1.default);
app.use('/api/dashboard', dashboard_1.default);
app.use('/api/tasks', tasks_1.default);
app.use('/api/interns', interns_1.default);
// ── HEALTH CHECK ──────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'OK',
        message: '✅ InternHub API is running',
        timestamp: new Date().toISOString(),
    });
});
// ── FALLBACK — serve landing page for all other routes
app.get('*path', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public', 'landing', 'landingpage.html'));
});
// ── START SERVER ──────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀  InternHub server running at http://localhost:${PORT}`);
});
exports.default = app;
