import React, { useState, useEffect, useCallback, useRef } from 'react';
import Masonry from 'react-masonry-css';
import Lottie from 'lottie-react';
import styles from '../styles/RecipesTab.module.css';
import { RecipeApi, Recipe } from '../services/api-recipes';
import { RecipeDetailView } from './RecipeDetailView';
import { API_BASE_URL } from '../services/api';
import cookingAnimation from '../cooking_loading.json';

type TabType = 'recommended' | 'favorites';

const ClockIcon = () => (
  <svg viewBox="0 0 960 960" fill="currentColor">
    <path d="M340.5,811.5Q275,783 226,734Q177,685 148.5,619.5Q120,554 120,480Q120,436 130,394.5Q140,353 159,316.5Q178,280 204.5,248.5Q231,217 264,192L536,464L480,520L264,304Q234,340 217,384.5Q200,429 200,480Q200,596 282,678Q364,760 480,760Q596,760 678,678Q760,596 760,480Q760,373 691.5,295.5Q623,218 520,204L520,280L440,280L440,120Q450,120 460,120Q470,120 480,120Q554,120 619.5,148.5Q685,177 734,226Q783,275 811.5,340.5Q840,406 840,480Q840,554 811.5,619.5Q783,685 734,734Q685,783 619.5,811.5Q554,840 480,840Q406,840 340.5,811.5ZM251.5,508.5Q240,497 240,480Q240,463 251.5,451.5Q263,440 280,440Q297,440 308.5,451.5Q320,463 320,480Q320,497 308.5,508.5Q297,520 280,520Q263,520 251.5,508.5ZM451.5,708.5Q440,697 440,680Q440,663 451.5,651.5Q463,640 480,640Q497,640 508.5,651.5Q520,663 520,680Q520,697 508.5,708.5Q497,720 480,720Q463,720 451.5,708.5ZM651.5,508.5Q640,497 640,480Q640,463 651.5,451.5Q663,440 680,440Q697,440 708.5,451.5Q720,463 720,480Q720,497 708.5,508.5Q697,520 680,520Q663,520 651.5,508.5Z" />
  </svg>
);

const FlameIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.5 0.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
  </svg>
);

const ChefHatIcon = () => (
  <svg viewBox="0 0 960 960" fill="currentColor">
    <path d="M360,560L440,560L440,360L360,360L360,560ZM200,500Q154,477 127,433.5Q100,390 100,339Q100,264 151.5,212Q203,160 278,160Q290,160 302.5,162Q315,164 327,167L327,167L327,167Q352,126 392,103Q432,80 480,80Q528,80 568,103Q608,126 633,167L633,167L633,167Q645,164 657,162Q669,160 682,160Q757,160 808.5,212Q860,264 860,339Q860,390 833,433.5Q806,477 760,500L760,720L200,720L200,500ZM520,560L600,560L600,360L520,360L520,560ZM280,640L680,640L680,451L724,429Q750,416 765,392.5Q780,369 780,340Q780,298 751.5,269Q723,240 682,240Q671,240 662,242Q653,244 643,247L596,260L565,208Q551,185 528.5,172.5Q506,160 480,160Q454,160 431.5,172.5Q409,185 395,208L364,260L316,247Q306,245 296.5,242.5Q287,240 277,240Q236,240 208,269Q180,298 180,340Q180,369 195,392.5Q210,416 236,429L280,451L280,640ZM200,720L280,720L280,800L680,800L680,720L760,720L760,880L200,880L200,720ZM480,640L480,640L480,640Q480,640 480,640Q480,640 480,640Q480,640 480,640Q480,640 480,640Q480,640 480,640Q480,640 480,640L480,640L480,640Q480,640 480,640Q480,640 480,640Q480,640 480,640Q480,640 480,640L480,640L480,640Q480,640 480,640Q480,640 480,640Q480,640 480,640Q480,640 480,640Q480,640 480,640L480,640L480,640Z" />
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
          ? <img src={`${API_BASE_URL}${recipe.imageUrl}`} alt={recipe.title} className={styles.recipeImage} />
          : <div className={styles.imagePlaceholder}>🍽️</div>
        }
        <div className={styles.gradientOverlay} />
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
              <span className={`${styles.metaIcon} ${styles.metaIconClock}`}><ClockIcon /></span>
              {recipe.cookingTime}
            </span>
          )}
          {recipe.difficulty && (
            <>
              <span className={styles.metaDivider} />
              <span className={styles.metaItem}>
                <span className={`${styles.metaIcon} ${styles.metaIconChef}`}><ChefHatIcon /></span>
                {recipe.difficulty}
              </span>
            </>
          )}
        </div>

        {hasNutrition && (
          <>
            <div className={styles.divider} />
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
          </>
        )}
      </div>
    </div>
  );
}

const RECIPE_CACHE_KEY = 'fridgemate_cached_recipes';

function loadCachedRecipes(): Recipe[] {
  try {
    const raw = localStorage.getItem(RECIPE_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCachedRecipes(recipes: Recipe[]) {
  try {
    localStorage.setItem(RECIPE_CACHE_KEY, JSON.stringify(recipes));
  } catch {}
}

const COOKING_TIPS = [
  'A pinch of salt can enhance sweetness in desserts',
  'Let meat rest after cooking for juicier results',
  'Fresh herbs should be added at the end of cooking',
  'Room temperature eggs blend better in batter',
  'Toast your spices to unlock deeper flavors',
  'Always preheat your pan before adding oil',
  'Acid like lemon juice brightens any dish',
  'Pat proteins dry for a better sear',
  'Use a sharp knife — it\'s safer than a dull one',
  'Season every layer as you cook, not just at the end',
];

export function RecipesTab({ onPostShared }: { onPostShared: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>('recommended');
  const [recommended, setRecommended] = useState<Recipe[]>(loadCachedRecipes);
  const [favorites, setFavorites] = useState<Recipe[]>([]);
const [loadingRecommended, setLoadingRecommended] = useState(() => loadCachedRecipes().length === 0);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoritingId, setFavoritingId] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const hasLoadedRef = useRef(recommended.length > 0);

  const loadRecommended = useCallback(async () => {
    setLoadingRecommended(true);
    setError(null);
    try {
      const recipes = await RecipeApi.getRecommended();
      setRecommended(recipes);
      saveCachedRecipes(recipes);
      hasLoadedRef.current = true;
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
    const favItems = data.items.map(r => ({ ...r, isFavorited: true }));
    setFavorites(favItems);
    
    const favIds = new Set(favItems.map(r => r._id));
    setRecommended(prev => prev.map(r => ({ 
      ...r, 
      isFavorited: favIds.has(r._id) 
    })));
  } catch (err: any) {
    setError(err?.response?.data?.message || err?.message || 'Failed to load favorites');
  } finally {
    setLoadingFavorites(false);
  }
}, []);
useEffect(() => {
  if (activeTab === 'recommended' && !hasLoadedRef.current) {
    loadRecommended();
  } else if (activeTab === 'favorites') {
    loadFavorites();
  } else if (activeTab === 'recommended' && hasLoadedRef.current) {
    RecipeApi.getFavorites().then(data => {
      const favIds = new Set(data.items.map((r: any) => r._id));
      setRecommended(prev => prev.map(r => ({
        ...r,
        isFavorited: favIds.has(r._id)
      })));
    }).catch(() => {});
  }
}, [activeTab, loadRecommended, loadFavorites]);

  // Cycle through cooking tips every 4 seconds
  useEffect(() => {
    if (!((activeTab === 'recommended' ? loadingRecommended : loadingFavorites))) {
      return; // Only cycle tips when loading
    }

    const interval = setInterval(() => {
      setFadeOut(true);
      setTimeout(() => {
        setTipIndex(prev => (prev + 1) % COOKING_TIPS.length);
        setFadeOut(false);
      }, 300);
    }, 4000);

    return () => clearInterval(interval);
  }, [loadingRecommended, loadingFavorites, activeTab]);

  const handleToggleFavorite = async (e: React.MouseEvent, recipe: Recipe) => {
    e.stopPropagation();
    if (favoritingId) return;

    const wasFavorited = !!recipe.isFavorited;
    const newFavorited = !wasFavorited;

    const applyTo = (arr: Recipe[]) =>
      arr.map(r => r._id === recipe._id ? { ...r, isFavorited: newFavorited } : r);
    const revertIn = (arr: Recipe[]) =>
      arr.map(r => r._id === recipe._id ? { ...r, isFavorited: wasFavorited } : r);

    // Optimistic update
    setRecommended(prev => applyTo(prev));
  setFavorites(prev => wasFavorited 
  ? prev.filter(r => r._id !== recipe._id) 
  : [...prev, { ...recipe, isFavorited: true }]
);
    if (selectedRecipe?._id === recipe._id)
      setSelectedRecipe(r => r ? { ...r, isFavorited: newFavorited } : null);

    setFavoritingId(recipe._id);
    try {
      if (wasFavorited) {
        await RecipeApi.removeFavorite(recipe._id);
      } else {
        await RecipeApi.addFavorite(recipe._id);
      }
} catch (err) {
  console.error('Favorite error:', err);
  setRecommended(prev => revertIn(prev));
  setFavorites(prev => revertIn(prev));
  if (selectedRecipe?._id === recipe._id)
    setSelectedRecipe(r => r ? { ...r, isFavorited: wasFavorited } : null);
} finally {
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
            <Lottie animationData={cookingAnimation} loop autoplay style={{ width: '200px', height: '200px' }} />
            <h2 className={styles.loadingTitle}>
              {activeTab === 'recommended' ? 'Generating recipes from your fridge…' : 'Loading favorites…'}
            </h2>
            <p className={`${styles.loadingTip} ${fadeOut ? styles.tipFadeOut : styles.tipFadeIn}`}>
              {COOKING_TIPS[tipIndex]}
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
              default: 3,
              900: 2,
              600: 1
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
