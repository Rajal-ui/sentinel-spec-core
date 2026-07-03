import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { validate } from '../middleware/validate.js'
import * as userController from '../controllers/user.controller.js'

const router = Router()

// All user routes require authentication
router.use(authenticate)

router.get('/me', userController.getMe)
router.patch('/profile', validate(userController.updateProfileSchema), userController.updateProfile)
router.patch('/password', validate(userController.updatePasswordSchema), userController.updatePassword)

export default router
