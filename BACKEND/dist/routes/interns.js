"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const interns_controller_1 = require("../controllers/interns.controller");
const auth_1 = __importDefault(require("../middleware/auth"));
const router = (0, express_1.Router)();
router.get('/', auth_1.default, interns_controller_1.getInterns);
router.get('/:id', auth_1.default, interns_controller_1.getInternById);
exports.default = router;
