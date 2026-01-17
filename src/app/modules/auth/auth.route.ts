import express from "express";
import { verifyFirebaseAuth } from "../../middlewares/verifyFirebaseAuth";
import { AuthController } from "./auth.controller";

const router = express.Router();

router.post("/sync-user", verifyFirebaseAuth, AuthController.SyncUserWithRole);

export const AuthRoutes = router;
