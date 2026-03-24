import { Router } from 'express';
import { RecipeController } from '../controllers/recipe.controller';
import { requireAuth } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { RecipeIdParamsSchema } from '../validators/recipe.validators';

const router = Router();

router.post('/:id/favorite', requireAuth, validate({ params: RecipeIdParamsSchema }), RecipeController.addToFavorites);
router.delete('/:id/favorite', requireAuth, validate({ params: RecipeIdParamsSchema }), RecipeController.removeFromFavorites);
router.get('/:id', requireAuth, validate({ params: RecipeIdParamsSchema }), RecipeController.getRecipeById);

export default router;
