import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

router.get("/auth/user", (req: Request, res: Response): void => {
  res.json({ user: req.isAuthenticated() ? req.user : null });
});

export default router;
