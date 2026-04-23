import { Router } from 'express'
import csrfRouter from './csrf.js'
import devLoginRouter from './dev-login.js'
import registerRouter from './register.js'
import loginRouter from './login.js'
import passwordResetRouter from './password-reset.js'
import refreshRouter from './refresh.js'
import logoutRouter from './logout.js'
import switchBusinessRouter from './switch-business.js'
import meRouter from './me.js'

const router = Router()

router.use(csrfRouter)
router.use(devLoginRouter)
router.use(registerRouter)
router.use(loginRouter)
router.use(passwordResetRouter)
router.use(refreshRouter)
router.use(logoutRouter)
router.use(switchBusinessRouter)
router.use(meRouter)

export default router
