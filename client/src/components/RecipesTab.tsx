import React from 'react';
import styles from '../styles/RecipesTab.module.css';

export function RecipesTab() {
  return (
    <div className={styles.recipesTab}>
      <div className={styles.placeholder}>
        <div className={styles.icon}>👨‍🍳</div>
        <h2>Recipes</h2>
        <p>Coming soon...</p>
      </div>
    </div>
  );
}
