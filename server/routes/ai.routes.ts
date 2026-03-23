import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { isAuthorized } from '../middlewares/authorization';
import { validate } from '../middlewares/validate';
import { GenerateRecipesSchema, AskAISchema } from '../validators/ai.validators';

const router = Router();

router.post('/recipes/generate', isAuthorized, validate({ body: GenerateRecipesSchema }), AIController.generateRecipes);
router.post('/ask', isAuthorized, validate({ body: AskAISchema }), AIController.askAI);

export default router;

