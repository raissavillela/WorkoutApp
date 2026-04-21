import { Router, type IRouter } from "express";
import healthRouter from "./health";
import exerciseMediaRouter from "./exerciseMedia";

const router: IRouter = Router();

router.use(healthRouter);
router.use(exerciseMediaRouter);

export default router;
