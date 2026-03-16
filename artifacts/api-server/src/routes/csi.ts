import { Router, type IRouter } from "express";
import { loadCsiDivisionsFromDb } from "../lib/csiDivisions";
import { CLOSEOUT_PACKAGE_SECTIONS } from "../lib/closeoutSections";

const router: IRouter = Router();

router.get("/csi/divisions", async (_req, res): Promise<void> => {
  const divisions = await loadCsiDivisionsFromDb();
  res.json(divisions);
});

router.get("/closeout-sections", (_req, res): void => {
  res.json(CLOSEOUT_PACKAGE_SECTIONS);
});

export default router;
