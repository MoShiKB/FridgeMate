import { Router } from 'express';
import { RecipeController } from '../controllers/recipe.controller';
import { isAuthorized } from '../middlewares/authorization';
import { validate } from '../middlewares/validate';
import { RecipeIdParamsSchema } from '../validators/recipe.validators';

const router = Router();

router.post('/:id/favorite', isAuthorized, validate({ params: RecipeIdParamsSchema }), RecipeController.addToFavorites);
router.delete('/:id/favorite', isAuthorized, validate({ params: RecipeIdParamsSchema }), RecipeController.removeFromFavorites);
router.get('/:id', isAuthorized, validate({ params: RecipeIdParamsSchema }), RecipeController.getRecipeById);

export default router;
