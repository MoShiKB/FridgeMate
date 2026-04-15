import React from 'react';
import styles from '../styles/FeedTab.module.css';

export function FeedTab() {
  return (
    <div className={styles.feedTab}>
      <div className={styles.placeholder}>
        <div className={styles.icon}>📰</div>
        <h2>Feed</h2>
        <p>Coming soon...</p>
      </div>
    </div>
  );
}
