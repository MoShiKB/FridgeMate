import { Router } from 'express';
import { RecipeController } from '../controllers/recipe.controller';
import { requireAuth } from '../middlewares/auth';

const router = Router();

router.post('/:id/favorite', requireAuth, RecipeController.addToFavorites);
router.delete('/:id/favorite', requireAuth, RecipeController.removeFromFavorites);
router.get('/:id', requireAuth, RecipeController.getRecipeById);

export default router;
