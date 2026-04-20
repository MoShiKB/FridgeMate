import { Router } from 'express';
import { RecipeController } from '../controllers/recipe.controller';
import { requireAuth } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { RecipeIdParamsSchema, RecipePaginationQuerySchema } from '../validators/recipe.validators';

const router = Router();

router.get('/favorites', requireAuth, validate({ query: RecipePaginationQuerySchema }), asyncHandler(RecipeController.getUserFavorites));
router.post('/:id/favorite', requireAuth, validate({ params: RecipeIdParamsSchema }), asyncHandler(RecipeController.addToFavorites));
router.delete('/:id/favorite', requireAuth, validate({ params: RecipeIdParamsSchema }), asyncHandler(RecipeController.removeFromFavorites));
router.get('/:id', requireAuth, validate({ params: RecipeIdParamsSchema }), asyncHandler(RecipeController.getRecipeById));

export default router;
