import { Router } from 'express';
import { RecipeController } from '../controllers/recipe.controller';
import { requireAuth } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { RecipeIdParamsSchema } from '../validators/recipe.validators';

const router = Router();

router.post('/:id/favorite', requireAuth, validate({ params: RecipeIdParamsSchema }), asyncHandler(RecipeController.addToFavorites));
router.delete('/:id/favorite', requireAuth, validate({ params: RecipeIdParamsSchema }), asyncHandler(RecipeController.removeFromFavorites));
router.get('/:id', requireAuth, validate({ params: RecipeIdParamsSchema }), asyncHandler(RecipeController.getRecipeById));

export default router;
