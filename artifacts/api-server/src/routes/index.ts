import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profilesRouter from "./profiles";
import profilePhotoRouter from "./profilePhoto";
import encountersRouter from "./encounters";
import presenceRouter from "./presence";
import bleRouter from "./ble";
import revealsRouter from "./reveals";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profilesRouter);
router.use(profilePhotoRouter);
router.use(encountersRouter);
router.use(presenceRouter);
router.use(bleRouter);
router.use(revealsRouter);

export default router;
