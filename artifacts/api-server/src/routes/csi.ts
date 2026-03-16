import { Router, type IRouter } from "express";
import { CSI_DIVISIONS } from "../lib/csiDivisions";

const router: IRouter = Router();

router.get("/csi/divisions", (_req, res): void => {
  res.json(CSI_DIVISIONS);
});

export default router;
