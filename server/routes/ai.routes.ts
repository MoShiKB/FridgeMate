import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { requireAuth } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { GenerateRecipesSchema, AskAISchema } from '../validators/ai.validators';

const router = Router();

router.post('/recipes/generate', requireAuth, validate({ body: GenerateRecipesSchema }), AIController.generateRecipes);
router.post('/ask', requireAuth, validate({ body: AskAISchema }), AIController.askAI);

export default router;

