import { Router } from 'express';
import publicRouter from './public.js';
import adminRouter from './admin/index.js';

const router = Router();
router.use(publicRouter);
router.use('/admin', adminRouter);

export default router;
