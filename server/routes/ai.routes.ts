import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { isAuthorized } from '../middlewares/authorization';

const router = Router();

router.post('/recipes/generate', isAuthorized, AIController.generateRecipes);
router.post('/ask', isAuthorized, AIController.askAI);

export default router;

