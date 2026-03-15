import React, { useState } from 'react';
import { MyFridgeTab } from '../components/MyFridgeTab';
import { FeedTab } from '../components/FeedTab';
import { RecipesTab } from '../components/RecipesTab';
import styles from '../styles/Dashboard.module.css';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'feed' | 'myFridge' | 'recipes'>('myFridge');

  // Mock user data - replace with actual user data from API/context
  const user = {
    name: 'Sarah',
    profilePicture: null, // TODO: Replace with actual profile picture URL
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/';
  };

  return (
    <div className={styles.dashboard}>
      {/* Header with welcome message and profile */}
      <div className={styles.header}>
        <div className={styles.userInfo}>
          <div className={styles.profilePictureContainer}>
            {user.profilePicture ? (
              <img
                src={user.profilePicture}
                alt="Profile"
                className={styles.profilePicture}
              />
            ) : (
              <div className={styles.profilePlaceholder}>
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <h1 className={styles.welcomeText}>
            Welcome back, <span className={styles.userName}>{user.name}</span>
          </h1>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabsContainer}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'feed' ? styles.active : ''}`}
            onClick={() => setActiveTab('feed')}
            title="Feed"
          >
            <img src="/assets/images/ic_feed.svg" alt="Feed" className={`${styles.tabIcon} ${activeTab === 'feed' ? styles.activeIcon : ''}`} />
            <span>Feed</span>
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'myFridge' ? styles.active : ''}`}
            onClick={() => setActiveTab('myFridge')}
            title="My Fridge"
          >
            <img src="/assets/images/ic_myfridge.svg" alt="My Fridge" className={`${styles.tabIcon} ${activeTab === 'myFridge' ? styles.activeIcon : ''}`} />
            <span>My Fridge</span>
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'recipes' ? styles.active : ''}`}
            onClick={() => setActiveTab('recipes')}
            title="Recipes"
          >
            <img src="/assets/images/ic_recipes.svg" alt="Recipes" className={`${styles.tabIcon} ${activeTab === 'recipes' ? styles.activeIcon : ''}`} />
            <span>Recipes</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'feed' && <FeedTab />}
        {activeTab === 'myFridge' && <MyFridgeTab />}
        {activeTab === 'recipes' && <RecipesTab />}
      </div>
    </div>
  );
}
