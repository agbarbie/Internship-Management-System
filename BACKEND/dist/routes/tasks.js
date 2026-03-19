"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tasks_controller_1 = require("../controllers/tasks.controller");
const auth_1 = __importDefault(require("../middleware/auth"));
const router = (0, express_1.Router)();
router.get('/', auth_1.default, tasks_controller_1.getTasks);
router.get('/:id', auth_1.default, tasks_controller_1.getTaskById);
router.post('/', auth_1.default, tasks_controller_1.createTask);
router.post('/:id/submit', auth_1.default, tasks_controller_1.submitTask);
router.patch('/:id/review', auth_1.default, tasks_controller_1.reviewTask);
router.get('/:id/files', auth_1.default, tasks_controller_1.getTaskFiles);
exports.default = router;
