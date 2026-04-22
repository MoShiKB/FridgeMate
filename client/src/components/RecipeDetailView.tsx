import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import styles from '../styles/RecipeDetailView.module.css';
import { Recipe } from '../services/api-recipes';
import { FeedApi } from '../services/api-feed';
import { API_BASE_URL } from '../services/api';

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

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !text.trim()) {
      setError('Please fill in both fields.');
      return;
    }
    setPosting(true);
    setError('');
    try {
      await FeedApi.createPost({ title: title.trim(), text: text.trim() });
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
          <form onSubmit={handleShare}>
            <h3 className={styles.shareTitle}>Share your creation</h3>
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

  return (
    <div className={styles.detailView}>
      {/* Hero image */}
      <div className={styles.heroWrapper}>
        {recipe.imageUrl
          ? <img src={`${API_BASE_URL}${recipe.imageUrl}`} alt={recipe.title} className={styles.heroImage} />
          : <div className={styles.heroPlaceholder}>🍽️</div>
        }
        <div className={styles.heroGradient} />

        <button className={styles.backBtn} onClick={onBack} title="Back">
          <BackIcon />
        </button>

        <button
          className={styles.heroStarBtn}
          onClick={() => onFavoriteToggle(recipe)}
          disabled={isFavoriting}
          title={recipe.isFavorited ? 'Remove from favorites' : 'Save'}
        >
          <StarIcon filled={!!recipe.isFavorited} />
        </button>
      </div>

      {/* Content */}
      <div className={styles.detailContent}>
        <h1 className={styles.detailTitle}>{recipe.title}</h1>

        <div className={styles.detailMeta}>
          {recipe.cookingTime && (
            <span className={styles.detailMetaItem}>
              <span className={styles.detailMetaIcon}><ClockIcon /></span>
              {recipe.cookingTime}
            </span>
          )}
          {recipe.difficulty && (
            <span className={styles.detailMetaItem}>
              <span className={styles.detailMetaIcon}><FlameIcon /></span>
              {recipe.difficulty}
            </span>
          )}
        </div>

        {recipe.description && (
          <p className={styles.detailDescription}>{recipe.description}</p>
        )}

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

        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Ingredients</h2>
            <ul className={styles.ingredientList}>
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className={styles.ingredientItem}>
                  <span className={styles.ingredientDot} />
                  <span className={styles.ingredientText}>
                    {ing.name}
                    {ing.amount ? <span className={styles.ingredientAmount}> — {ing.amount}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {recipe.steps && recipe.steps.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Steps</h2>
            <ol className={styles.stepList}>
              {recipe.steps.map((step, i) => (
                <li key={i} className={styles.stepItem}>
                  <span className={styles.stepNumber}>{i + 1}</span>
                  <span className={styles.stepText}>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <button className={styles.shareBtn} onClick={() => setShowShare(true)}>
          <ShareArrowIcon />
          Share your creation
        </button>
      </div>

      {showShare && (
        <ShareModal recipe={recipe} onClose={() => setShowShare(false)} onPostShared={onPostShared} />
      )}
    </div>
  );
}
