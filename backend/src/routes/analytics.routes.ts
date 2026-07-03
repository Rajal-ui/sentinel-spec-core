import { Router } from 'express'
import { optionalAuth } from '../middleware/authenticate.js'
import * as analyticsController from '../controllers/analytics.controller.js'

const router = Router()

router.use(optionalAuth)

router.get('/summary', analyticsController.getSummary)

export default router
