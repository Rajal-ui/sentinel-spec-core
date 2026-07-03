import { Router } from 'express'
import { optionalAuth } from '../middleware/authenticate.js'
import * as findingsController from '../controllers/findings.controller.js'

const router = Router()

router.use(optionalAuth)

router.get('/', findingsController.listFindings)
router.post('/bulk', findingsController.bulkCreate)
router.patch('/:id/resolve', findingsController.resolveFinding)

export default router
