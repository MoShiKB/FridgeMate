import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { requireAuth } from '../middlewares/auth';

const router = Router();

router.post('/recipes/generate', requireAuth, AIController.generateRecipes);
router.post('/ask', requireAuth, AIController.askAI);

export default router;

