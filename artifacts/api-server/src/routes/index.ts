import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pfSenhaRouter from "./pfSenha";
import adminRouter from "./admin";
import accessRouter from "./access";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pfSenhaRouter);
router.use(adminRouter);
router.use(accessRouter);

export default router;
