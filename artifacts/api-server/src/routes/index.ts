import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profilesRouter from "./profiles";
import profilePhotoRouter from "./profilePhoto";
import encountersRouter from "./encounters";
import presenceRouter from "./presence";
import bleRouter from "./ble";
import revealsRouter from "./reveals";
import connectionsRouter from "./connections";
import reportsRouter from "./reports";
import referralsRouter from "./referrals";
import networksRouter from "./networks";
import chatsRouter from "./chats";
import engagementRouter from "./engagement";
import pioneerRouter from "./pioneer";
import adminRouter from "./admin";
import trophiesRouter from "./trophies";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profilesRouter);
router.use(profilePhotoRouter);
router.use(encountersRouter);
router.use(presenceRouter);
router.use(bleRouter);
router.use(revealsRouter);
router.use(connectionsRouter);
router.use(reportsRouter);
router.use(referralsRouter);
router.use(networksRouter);
router.use(chatsRouter);
router.use(engagementRouter);
router.use(pioneerRouter);
router.use(adminRouter);
router.use(trophiesRouter);

export default router;
