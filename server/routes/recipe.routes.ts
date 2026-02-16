import { Router } from 'express';
import { RecipeController } from '../controllers/recipe.controller';
import { isAuthorized } from '../middlewares/authorization';

const router = Router();

router.post('/save', isAuthorized, RecipeController.saveToFavorites);
router.get('/:id', isAuthorized, RecipeController.getRecipeById);

export default router;

