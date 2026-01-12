import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { isAuthorized } from '../middlewares/authorization';

const router = Router();

router.get('/', isAuthorized, UserController.getAllUsers);
router.get('/:id', isAuthorized, UserController.getUserById);
router.put('/:id', isAuthorized, UserController.updateProfile);

export default router;

