import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profilesRouter from "./profiles";
import encountersRouter from "./encounters";
import presenceRouter from "./presence";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profilesRouter);
router.use(encountersRouter);
router.use(presenceRouter);

export default router;
