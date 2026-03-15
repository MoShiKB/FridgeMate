import React, { useState, useRef, useEffect } from 'react';
import { MyFridgeTab } from '../components/MyFridgeTab';
import { FeedTab } from '../components/FeedTab';
import { RecipesTab } from '../components/RecipesTab';
import styles from '../styles/Dashboard.module.css';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'feed' | 'myFridge' | 'recipes'>('myFridge');
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const handleMyProfile = () => {
    // TODO: Implement navigate to profile page
    console.log('Navigate to profile');
    setShowMenu(false);
  };

  const handleSettings = () => {
    // TODO: Implement navigate to settings page
    console.log('Navigate to settings');
    setShowMenu(false);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  return (
    <div className={styles.dashboard}>
      {/* Header with welcome message and profile */}
      <div className={styles.header}>
        <div className={styles.userInfo}>
          <h1 className={styles.welcomeText}>
            Welcome back, <span className={styles.userName}>{user.name}</span>
          </h1>
        </div>

        {/* Profile Menu Button */}
        <div className={styles.menuContainer} ref={menuRef}>
          <button
            className={styles.profileMenuButton}
            onClick={() => setShowMenu(!showMenu)}
            title="Menu"
          >
            <div className={styles.profileMenuPlaceholder}>
              {user.name.charAt(0).toUpperCase()}
            </div>
          </button>

          {/* Menu Dropdown */}
          {showMenu && (
            <div className={styles.menu}>
              <button className={styles.menuItem} onClick={handleMyProfile}>
                <img src="/assets/images/ic_profile.svg" alt="" className={styles.menuItemIcon} />
                My profile
              </button>
              <button className={styles.menuItem} onClick={handleSettings}>
                <img src="/assets/images/ic_settings.svg" alt="" className={styles.menuItemIcon} />
                Settings
              </button>
              <button className={`${styles.menuItem} ${styles.logoutItem}`} onClick={handleLogout}>
                <img src="/assets/images/ic_logout.svg" alt="" className={styles.menuItemIcon} />
                Logout
              </button>
            </div>
          )}
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
