import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { requireAuth } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { GenerateRecipesSchema, AskAISchema } from '../validators/ai.validators';

const router = Router();

router.post('/recipes/generate', requireAuth, validate({ body: GenerateRecipesSchema }), asyncHandler(AIController.generateRecipes));
router.post('/ask', requireAuth, validate({ body: AskAISchema }), asyncHandler(AIController.askAI));

export default router;

