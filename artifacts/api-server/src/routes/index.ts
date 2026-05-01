import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profilesRouter from "./profiles";
import encountersRouter from "./encounters";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profilesRouter);
router.use(encountersRouter);

export default router;
