import React, { useState, useEffect, useCallback, useRef } from 'react';
import Masonry from 'react-masonry-css';
import styles from '../styles/RecipesTab.module.css';
import { RecipeApi, Recipe } from '../services/api-recipes';
import { RecipeDetailView } from './RecipeDetailView';

type TabType = 'recommended' | 'favorites';

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const FlameIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.5 0.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
  </svg>
);

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" fill={filled ? '#f5c518' : 'none'} stroke={filled ? '#f5c518' : '#555'} strokeWidth={2}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

function RecipeCard({
  recipe,
  onToggleFavorite,
  isFavoriting,
  onClick,
}: {
  recipe: Recipe;
  onToggleFavorite: (e: React.MouseEvent, recipe: Recipe) => void;
  isFavoriting: boolean;
  onClick: () => void;
}) {
  const hasNutrition = recipe.nutrition && (
    recipe.nutrition.calories || recipe.nutrition.fat ||
    recipe.nutrition.carbs || recipe.nutrition.protein
  );

  return (
    <div className={styles.recipeCard} onClick={onClick}>
      <div className={styles.imageWrapper}>
        {recipe.imageUrl
          ? <img src={recipe.imageUrl} alt={recipe.title} className={styles.recipeImage} />
          : <div className={styles.imagePlaceholder}>🍽️</div>
        }
        <button
          className={styles.starBtn}
          onClick={e => onToggleFavorite(e, recipe)}
          disabled={isFavoriting}
          title={recipe.isFavorited ? 'Remove from favorites' : 'Save'}
        >
          <StarIcon filled={!!recipe.isFavorited} />
        </button>
      </div>

      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{recipe.title}</h3>

        <div className={styles.cardMeta}>
          {recipe.cookingTime && (
            <span className={styles.metaItem}>
              <span className={styles.metaIcon}><ClockIcon /></span>
              {recipe.cookingTime}
            </span>
          )}
          {recipe.difficulty && (
            <span className={styles.metaItem}>
              <span className={styles.metaIcon}><FlameIcon /></span>
              {recipe.difficulty}
            </span>
          )}
        </div>

        {hasNutrition && (
          <div className={styles.nutritionRow}>
            {recipe.nutrition!.calories && (
              <div className={styles.nutritionCell}>
                <span className={styles.nutritionVal}>{recipe.nutrition!.calories}</span>
                <span className={styles.nutritionLbl}>kcal</span>
              </div>
            )}
            {recipe.nutrition!.fat && (
              <div className={styles.nutritionCell}>
                <span className={styles.nutritionVal}>{recipe.nutrition!.fat}</span>
                <span className={styles.nutritionLbl}>Fat</span>
              </div>
            )}
            {recipe.nutrition!.carbs && (
              <div className={styles.nutritionCell}>
                <span className={styles.nutritionVal}>{recipe.nutrition!.carbs}</span>
                <span className={styles.nutritionLbl}>Carbs</span>
              </div>
            )}
            {recipe.nutrition!.protein && (
              <div className={styles.nutritionCell}>
                <span className={styles.nutritionVal}>{recipe.nutrition!.protein}</span>
                <span className={styles.nutritionLbl}>Protein</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function RecipesTab({ onPostShared }: { onPostShared: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>('recommended');
  const [recommended, setRecommended] = useState<Recipe[]>([]);
  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [loadingRecommended, setLoadingRecommended] = useState(false);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoritingId, setFavoritingId] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const hasGeneratedRef = useRef(false);

  const loadRecommended = useCallback(async () => {
    setLoadingRecommended(true);
    setError(null);
    try {
      const recipes = await RecipeApi.getRecommended();
      setRecommended(recipes);
      hasGeneratedRef.current = true;
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to generate recipes');
    } finally {
      setLoadingRecommended(false);
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    setLoadingFavorites(true);
    setError(null);
    try {
      const data = await RecipeApi.getFavorites();
      setFavorites(data.items);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load favorites');
    } finally {
      setLoadingFavorites(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'recommended' && !hasGeneratedRef.current) {
      loadRecommended();
    } else if (activeTab === 'favorites') {
      loadFavorites();
    }
  }, [activeTab, loadRecommended, loadFavorites]);

  const handleToggleFavorite = async (e: React.MouseEvent, recipe: Recipe) => {
    e.stopPropagation();
    if (favoritingId) return;
    setFavoritingId(recipe._id);
    try {
      if (recipe.isFavorited) {
        await RecipeApi.removeFavorite(recipe._id);
        const update = (r: Recipe) => r._id === recipe._id ? { ...r, isFavorited: false } : r;
        setRecommended(prev => prev.map(update));
        setFavorites(prev => prev.filter(r => r._id !== recipe._id));
        if (selectedRecipe?._id === recipe._id) setSelectedRecipe(r => r ? { ...r, isFavorited: false } : null);
      } else {
        await RecipeApi.addFavorite(recipe._id);
        const update = (r: Recipe) => r._id === recipe._id ? { ...r, isFavorited: true } : r;
        setRecommended(prev => prev.map(update));
        if (selectedRecipe?._id === recipe._id) setSelectedRecipe(r => r ? { ...r, isFavorited: true } : null);
      }
    } catch { /* ignore */ } finally {
      setFavoritingId(null);
    }
  };

  const isLoading = activeTab === 'recommended' ? loadingRecommended : loadingFavorites;
  const currentList = activeTab === 'recommended' ? recommended : favorites;

  // Detail view
  if (selectedRecipe) {
    return (
      <div className={styles.recipesTab}>
        <RecipeDetailView
          recipe={selectedRecipe}
          onBack={() => setSelectedRecipe(null)}
          onFavoriteToggle={(r) => handleToggleFavorite({ stopPropagation: () => {} } as React.MouseEvent, r)}
          isFavoriting={favoritingId === selectedRecipe._id}
          onPostShared={onPostShared}
        />
      </div>
    );
  }

  return (
    <div className={styles.recipesTab}>
      {/* Pill tabs */}
      <div className={styles.pillContainer}>
        <div className={styles.pillTabs}>
          <button
            className={`${styles.pillTab} ${activeTab === 'recommended' ? styles.pillActive : ''}`}
            onClick={() => setActiveTab('recommended')}
          >
            Recommended
          </button>
          <button
            className={`${styles.pillTab} ${activeTab === 'favorites' ? styles.pillActive : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            Favorites
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {isLoading && (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>
              {activeTab === 'recommended' ? 'Generating recipes from your fridge…' : 'Loading favorites…'}
            </p>
          </div>
        )}

        {!isLoading && error && (
          <div className={styles.errorState}>
            <p>{error}</p>
            <button className={styles.retryBtn} onClick={activeTab === 'recommended' ? loadRecommended : loadFavorites}>
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && currentList.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>{activeTab === 'recommended' ? '🧊' : '⭐'}</div>
            <p className={styles.emptyTitle}>
              {activeTab === 'recommended' ? 'No fridge items found' : 'No favorites yet'}
            </p>
            <p className={styles.emptyDesc}>
              {activeTab === 'recommended'
                ? 'Add ingredients to your fridge to get recipe recommendations'
                : 'Save recipes from the Recommended tab'}
            </p>
          </div>
        )}

        {!isLoading && !error && currentList.length > 0 && (
          <Masonry
            breakpointCols={{
              default: 2,
              900: 1
            }}
            className={styles.masonryGrid}
            columnClassName={styles.masonryColumn}
          >
            {currentList.map(recipe => (
              <RecipeCard
                key={recipe._id}
                recipe={recipe}
                onToggleFavorite={handleToggleFavorite}
                isFavoriting={favoritingId === recipe._id}
                onClick={() => setSelectedRecipe(recipe)}
              />
            ))}
          </Masonry>
        )}
      </div>

      {/* Floating generate button */}
      {activeTab === 'recommended' && !isLoading && (
        <button className={styles.generateBtn} onClick={loadRecommended}>
          Generate New Recipes
        </button>
      )}
    </div>
  );
}
