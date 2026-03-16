import { Router, type IRouter } from "express";
import { loadCsiDivisionsFromDb } from "../lib/csiDivisions";

const router: IRouter = Router();

router.get("/csi/divisions", async (_req, res): Promise<void> => {
  const divisions = await loadCsiDivisionsFromDb();
  res.json(divisions);
});

export default router;
