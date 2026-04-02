import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import storageRouter from "./storage";
import projectsRouter from "./projects";
import subcontractorsRouter from "./subcontractors";
import documentsRouter from "./documents";
import csiRouter from "./csi";
import clientPortalRouter from "./clientPortal";
import aiRouter from "./ai";
import downloadRouter from "./download";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(projectsRouter);
router.use(subcontractorsRouter);
router.use(documentsRouter);
router.use(csiRouter);
router.use(clientPortalRouter);
router.use(aiRouter);
router.use(downloadRouter);

export default router;
