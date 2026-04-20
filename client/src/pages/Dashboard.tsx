import React, { useState, useRef, useEffect } from 'react';
import { MyFridgeTab } from '../components/MyFridgeTab';
import { FeedTab } from '../components/FeedTab';
import { RecipesTab } from '../components/RecipesTab';
import SettingsScreen from '../components/SettingsScreen';
import MyProfileScreen from '../components/MyProfileScreen';
import { tokenManager } from '../services/api';
import { ProfileApi } from '../services/api-profile';
import styles from '../styles/Dashboard.module.css';

function getUserIdFromToken(): string | null {
  const token = tokenManager.getAccessToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1])).userId || null;
  } catch {
    return null;
  }
}

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'feed' | 'myFridge' | 'recipes'>('myFridge');
  const [showMenu, setShowMenu] = useState(false);
  const [currentView, setCurrentView] = useState<'tabs' | 'profile' | 'settings'>('tabs');
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});
  const [userName, setUserName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const userId = getUserIdFromToken();
    if (!userId) return;
    const { request, abort } = ProfileApi.getMyProfile(userId);
    request.then(res => setUserName(res.data.displayName || '')).catch(() => {});
    return () => abort();
  }, []);

  const user = { name: userName };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/';
  };

  const saveScrollPosition = () => {
    if (tabContentRef.current) {
      setScrollPositions(prev => ({
        ...prev,
        [activeTab]: tabContentRef.current?.scrollTop || 0
      }));
    }
  };

  const restoreScrollPosition = () => {
    if (tabContentRef.current) {
      const savedScroll = scrollPositions[activeTab] || 0;
      tabContentRef.current.scrollTop = savedScroll;
    }
  };

  const handleMyProfile = () => {
    saveScrollPosition();
    setCurrentView('profile');
    setShowMenu(false);
  };

  const handleSettings = () => {
    saveScrollPosition();
    setCurrentView('settings');
    setShowMenu(false);
  };

  const handleBack = () => {
    setCurrentView('tabs');
    // Restore scroll position on next render
    setTimeout(restoreScrollPosition, 0);
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

  // Simple scrollbar auto-hide on both tab content and overlays
  useEffect(() => {
    let hideTimer: NodeJS.Timeout | null = null;

    const showScrollbar = () => {
      if (hideTimer) clearTimeout(hideTimer);
      document.body.classList.add('scrolling-active');
      
      hideTimer = setTimeout(() => {
        document.body.classList.remove('scrolling-active');
      }, 3000);
    };

    const tabElement = tabContentRef.current;
    if (tabElement) {
      tabElement.addEventListener('scroll', showScrollbar);
      return () => {
        tabElement.removeEventListener('scroll', showScrollbar);
        if (hideTimer) clearTimeout(hideTimer);
      };
    }
  }, []);

  // Handle scrollbar for overlays separately
  useEffect(() => {
    if (currentView === 'tabs') return;

    let hideTimer: NodeJS.Timeout | null = null;

    const showScrollbar = () => {
      if (hideTimer) clearTimeout(hideTimer);
      document.body.classList.add('scrolling-active');
      
      hideTimer = setTimeout(() => {
        document.body.classList.remove('scrolling-active');
      }, 3000);
    };

    const overlay = document.querySelector(`.${styles.overlay}`);
    if (overlay) {
      overlay.addEventListener('scroll', showScrollbar);
      return () => {
        overlay.removeEventListener('scroll', showScrollbar);
        if (hideTimer) clearTimeout(hideTimer);
      };
    }
  }, [currentView]);

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
              {user.name ? user.name.charAt(0).toUpperCase() : ''}
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
      <div className={styles.tabContent} ref={tabContentRef}>
        {activeTab === 'feed' && <FeedTab />}
        {activeTab === 'myFridge' && <MyFridgeTab />}
        {activeTab === 'recipes' && <RecipesTab onPostShared={() => setActiveTab('feed')} />}
      </div>

      {/* Profile/Settings Overlay */}
      {currentView === 'profile' && (
        <div className={styles.overlay}>
          <MyProfileScreen onBack={handleBack} />
        </div>
      )}
      {currentView === 'settings' && (
        <div className={styles.overlay}>
          <SettingsScreen onBack={handleBack} />
        </div>
      )}
    </div>
  );
}
