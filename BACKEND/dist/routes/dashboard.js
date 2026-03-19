"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboard_controller_1 = require("../controllers/dashboard.controller");
const auth_1 = __importDefault(require("../middleware/auth"));
const router = (0, express_1.Router)();
router.get('/stats', auth_1.default, dashboard_controller_1.getStats);
router.get('/activity', auth_1.default, dashboard_controller_1.getActivity);
router.get('/notifications', auth_1.default, dashboard_controller_1.getNotifications);
router.patch('/notifications/read', auth_1.default, dashboard_controller_1.markNotificationsRead);
exports.default = router;
