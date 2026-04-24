import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import styles from '../styles/RecipeDetailView.module.css';
import { Recipe } from '../services/api-recipes';
import { FeedApi } from '../services/api-feed';
import { API_BASE_URL } from '../services/api';

const ClockIcon = () => (
  <svg viewBox="0 0 960 960" fill="currentColor">
    <path d="M340.5,811.5Q275,783 226,734Q177,685 148.5,619.5Q120,554 120,480Q120,436 130,394.5Q140,353 159,316.5Q178,280 204.5,248.5Q231,217 264,192L536,464L480,520L264,304Q234,340 217,384.5Q200,429 200,480Q200,596 282,678Q364,760 480,760Q596,760 678,678Q760,596 760,480Q760,373 691.5,295.5Q623,218 520,204L520,280L440,280L440,120Q450,120 460,120Q470,120 480,120Q554,120 619.5,148.5Q685,177 734,226Q783,275 811.5,340.5Q840,406 840,480Q840,554 811.5,619.5Q783,685 734,734Q685,783 619.5,811.5Q554,840 480,840Q406,840 340.5,811.5ZM251.5,508.5Q240,497 240,480Q240,463 251.5,451.5Q263,440 280,440Q297,440 308.5,451.5Q320,463 320,480Q320,497 308.5,508.5Q297,520 280,520Q263,520 251.5,508.5ZM451.5,708.5Q440,697 440,680Q440,663 451.5,651.5Q463,640 480,640Q497,640 508.5,651.5Q520,663 520,680Q520,697 508.5,708.5Q497,720 480,720Q463,720 451.5,708.5ZM651.5,508.5Q640,497 640,480Q640,463 651.5,451.5Q663,440 680,440Q697,440 708.5,451.5Q720,463 720,480Q720,497 708.5,508.5Q697,520 680,520Q663,520 651.5,508.5Z" />
  </svg>
);

const ChefHatIcon = () => (
  <svg viewBox="0 0 960 960" fill="currentColor">
    <path d="M360,560L440,560L440,360L360,360L360,560ZM200,500Q154,477 127,433.5Q100,390 100,339Q100,264 151.5,212Q203,160 278,160Q290,160 302.5,162Q315,164 327,167L327,167L327,167Q352,126 392,103Q432,80 480,80Q528,80 568,103Q608,126 633,167L633,167L633,167Q645,164 657,162Q669,160 682,160Q757,160 808.5,212Q860,264 860,339Q860,390 833,433.5Q806,477 760,500L760,720L200,720L200,500ZM520,560L600,560L600,360L520,360L520,560ZM280,640L680,640L680,451L724,429Q750,416 765,392.5Q780,369 780,340Q780,298 751.5,269Q723,240 682,240Q671,240 662,242Q653,244 643,247L596,260L565,208Q551,185 528.5,172.5Q506,160 480,160Q454,160 431.5,172.5Q409,185 395,208L364,260L316,247Q306,245 296.5,242.5Q287,240 277,240Q236,240 208,269Q180,298 180,340Q180,369 195,392.5Q210,416 236,429L280,451L280,640ZM200,720L280,720L280,800L680,800L680,720L760,720L760,880L200,880L200,720ZM480,640L480,640L480,640Q480,640 480,640Q480,640 480,640Q480,640 480,640Q480,640 480,640Q480,640 480,640Q480,640 480,640L480,640L480,640Q480,640 480,640Q480,640 480,640Q480,640 480,640Q480,640 480,640L480,640L480,640Q480,640 480,640Q480,640 480,640Q480,640 480,640Q480,640 480,640Q480,640 480,640L480,640L480,640Z" />
  </svg>
);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" fill={filled ? '#f5c518' : 'none'} stroke={filled ? '#f5c518' : 'currentColor'} strokeWidth={2}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const ShareArrowIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

async function getLocation(): Promise<{ lat: number; lng: number } | null> {
  if (navigator.geolocation) {
    const loc = await new Promise<{ lat: number; lng: number } | null>(resolve => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
        () => resolve(null),
        { timeout: 5000, maximumAge: 60000 }
      );
    });
    if (loc) return loc;
  }
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    if (data.latitude && data.longitude) return { lat: data.latitude, lng: data.longitude };
  } catch {}
  return null;
}

interface ShareModalProps {
  recipe: Recipe;
  onClose: () => void;
  onPostShared: () => void;
}

function ShareModal({ recipe, onClose, onPostShared }: ShareModalProps) {
  const [title, setTitle] = useState(`I made ${recipe.title}!`);
  const [text, setText] = useState(recipe.description || '');
  const [posting, setPosting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const locationRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    getLocation().then(loc => { if (loc) locationRef.current = loc; });
  }, []);

  const recipeImageUrl = recipe.imageUrl
    ? recipe.imageUrl.startsWith('http') ? recipe.imageUrl : `${API_BASE_URL}${recipe.imageUrl}`
    : null;

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !text.trim()) {
      setError('Please fill in both fields.');
      return;
    }
    setPosting(true);
    setError('');
    const location = locationRef.current ?? await getLocation();
    if (location) locationRef.current = location;
    try {
      await FeedApi.createPost({
        title: title.trim(),
        text: text.trim(),
        ...(recipeImageUrl ? { mediaUrls: [recipeImageUrl] } : {}),
        ...(location ? { location } : {}),
        recipeId: recipe._id,
      });
      setDone(true);
      setTimeout(() => { onClose(); onPostShared(); }, 1000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to post. Please try again.');
      setPosting(false);
    }
  };

  return ReactDOM.createPortal(
    <div className={styles.shareOverlay} onClick={onClose}>
      <div className={styles.shareModal} onClick={e => e.stopPropagation()}>
        {done ? (
          <div className={styles.shareSuccess}>
            <span className={styles.shareSuccessIcon}>✓</span>
            <p>Shared to Feed!</p>
          </div>
        ) : (
          <form onSubmit={handleShare} className={styles.shareForm}>
            <h3 className={styles.shareTitle}>Share your creation</h3>
            {recipeImageUrl && (
              <img
                src={recipeImageUrl}
                alt={recipe.title}
                className={styles.shareRecipeImage}
              />
            )}
            <input
              className={styles.shareInput}
              value={title}
              onChange={e => { setTitle(e.target.value); setError(''); }}
              placeholder="Title"
              maxLength={100}
              autoFocus
            />
            <textarea
              className={styles.shareTextarea}
              value={text}
              onChange={e => { setText(e.target.value); setError(''); }}
              placeholder="How did it turn out? Any tips?"
              rows={4}
            />
            {error && <p className={styles.shareError}>{error}</p>}
            <div className={styles.shareActions}>
              <button type="button" className={styles.shareCancelBtn} onClick={onClose}>Cancel</button>
              <button type="submit" className={styles.sharePostBtn} disabled={posting}>
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}

interface RecipeDetailViewProps {
  recipe: Recipe;
  onBack: () => void;
  onFavoriteToggle: (recipe: Recipe) => void;
  isFavoriting: boolean;
  onPostShared: () => void;
}

export function RecipeDetailView({ recipe, onBack, onFavoriteToggle, isFavoriting, onPostShared }: RecipeDetailViewProps) {
  const [showShare, setShowShare] = useState(false);

  const hasNutrition = recipe.nutrition && (
    recipe.nutrition.calories || recipe.nutrition.fat ||
    recipe.nutrition.carbs || recipe.nutrition.protein
  );

  const hasIngredients = recipe.ingredients && recipe.ingredients.length > 0;
  const hasSteps = recipe.steps && recipe.steps.length > 0;

  return (
    <div className={styles.detailView}>

      {/* Top bar */}
      <div className={styles.topBar}>
        <button className={styles.topBackBtn} onClick={onBack} title="Back"><BackIcon /></button>
        <button className={styles.topStarBtn} onClick={() => onFavoriteToggle(recipe)} disabled={isFavoriting} title={recipe.isFavorited ? 'Remove from favorites' : 'Save'}>
          <StarIcon filled={!!recipe.isFavorited} />
        </button>
      </div>

      {/* Header card: image left + info right */}
      <div className={styles.headerCard}>
        <div className={styles.thumbWrapper}>
          {recipe.imageUrl
            ? <img src={`${API_BASE_URL}${recipe.imageUrl}`} alt={recipe.title} className={styles.thumbImg} />
            : <div className={styles.thumbPlaceholder}>🍽️</div>
          }
        </div>
        <div className={styles.headerInfo}>
          <h1 className={styles.recipeTitle}>{recipe.title}</h1>
          {(recipe.cookingTime || recipe.difficulty) && (
            <div className={styles.metaRow}>
              {recipe.cookingTime && (
                <span className={styles.metaItem}>
                  <span className={styles.metaIcon}><ClockIcon /></span>
                  {recipe.cookingTime}
                </span>
              )}
              {recipe.difficulty && (
                <span className={styles.metaItem}>
                  <span className={styles.metaIcon}><ChefHatIcon /></span>
                  {recipe.difficulty}
                </span>
              )}
            </div>
          )}
          {recipe.description && (
            <p className={styles.detailDescription}>{recipe.description}</p>
          )}
        </div>
      </div>

      {/* Nutrition row */}
      {hasNutrition && (
        <div className={styles.nutritionCard}>
          {recipe.nutrition!.calories && (
            <div className={styles.nutritionCell}>
              <span className={`${styles.nutritionVal} ${styles.nutritionValKcal}`}>{recipe.nutrition!.calories}</span>
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

      {/* Ingredients + Steps side by side */}
      {(hasIngredients || hasSteps) && (
        <div className={styles.sectionRow}>
          {hasIngredients && (
            <div className={`${styles.sectionCard} ${styles.sectionCardIngredients}`}>
              <p className={styles.splitHeading}>Ingredients ({recipe.ingredients!.length})</p>
              <ul className={styles.ingredientList}>
                {recipe.ingredients!.map((ing, i) => (
                  <li key={i} className={styles.ingredientItem}>
                    <span className={styles.ingredientDot} />
                    <span className={styles.ingredientText}>{ing.name}</span>
                    {ing.amount && <span className={styles.ingredientAmount}>{ing.amount}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasSteps && (
            <div className={`${styles.sectionCard} ${styles.sectionCardSteps}`}>
              <p className={styles.splitHeading}>Steps ({recipe.steps!.length})</p>
              <ol className={styles.stepList}>
                {recipe.steps!.map((step, i) => (
                  <li key={i} className={styles.stepItem}>
                    <span className={styles.stepNumber}>{i + 1}</span>
                    <span className={styles.stepText}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      <button className={styles.shareBtn} onClick={() => setShowShare(true)}>
        <ShareArrowIcon />
        Share your creation
      </button>

      {showShare && (
        <ShareModal recipe={recipe} onClose={() => setShowShare(false)} onPostShared={onPostShared} />
      )}
    </div>
  );
}
