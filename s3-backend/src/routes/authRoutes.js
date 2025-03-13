import express from "express";
import { registerUser, loginUser, getUserInfo } from "../controllers/authController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", authenticate, getUserInfo);

export default router;
