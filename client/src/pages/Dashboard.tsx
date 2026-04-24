import React, { useState, useRef, useEffect } from 'react';
import { MyFridgeTab } from '../components/MyFridgeTab';
import { FeedTab } from '../components/FeedTab';
import { RecipesTab } from '../components/RecipesTab';
import SettingsScreen from '../components/SettingsScreen';
import MyProfileScreen from '../components/MyProfileScreen';
import { Chat, UserListPage } from '../components/chat';
import styles from '../styles/Dashboard.module.css';
import { ProfileApi } from '../services/api-profile';
import { tokenManager } from '../services/api';
import { FiCheckCircle } from '../components/icons';
function getCurrentUserId(): string | null {
  const token = tokenManager.getAccessToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1])).userId || null;
  } catch {
    return null;
  }
}

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'feed' | 'myFridge' | 'recipes'>('feed');
  const [showMenu, setShowMenu] = useState(false);
  const [currentView, setCurrentView] = useState<'tabs' | 'profile' | 'settings'>('tabs');
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});
  const [user, setUser] = useState<{ name: string; profilePicture: string | null }>({
    name: 'Loading...',
    profilePicture: null,
  });
  const [isUserListOpen, setIsUserListOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatId, setChatId] = useState('');
  const [chatUserName, setChatUserName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);
  const myFridgeTabRef = useRef<{ loadItems: () => void }>(null);
  const currentUserId = getCurrentUserId();
const [showScanToast, setShowScanToast] = useState(false);
  // Fetch user data function (can be called anytime)
  const fetchUserData = async () => {
    try {
      const token = tokenManager.getAccessToken();
      if (!token) {
        return;
      }

      const userId = JSON.parse(atob(token.split('.')[1])).userId;
      
      const { request } = ProfileApi.getMyProfile(userId);
      const response = await request;
      
      const userData = response.data;
      const userName = userData.userName || userData.displayName || userData.fullName || 'User';
      
      setUser({
        name: userName,
        profilePicture: userData.profileImage || null,
      });
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      setUser({ name: 'User', profilePicture: null });
    }
  };

  // Fetch user data on mount
  useEffect(() => {
    fetchUserData();
  }, []);

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
    // Refetch user data in case profile was updated
    fetchUserData();
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

  // Handle scrollbar auto-hide for tab content
  useEffect(() => {
    const tabElement = tabContentRef.current;
    if (!tabElement) return;

    let hideTimer: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      if (hideTimer) clearTimeout(hideTimer);
      tabElement.classList.add('tab-content-scrolling');
      
      hideTimer = setTimeout(() => {
        tabElement.classList.remove('tab-content-scrolling');
      }, 3000);
    };

    tabElement.addEventListener('scroll', handleScroll);
    return () => {
      tabElement.removeEventListener('scroll', handleScroll);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  // Handle scrollbar auto-hide for overlay
  useEffect(() => {
    if (currentView === 'tabs') return;

    const overlay = document.querySelector(`.${styles.overlay}`);
    if (!overlay) return;

    let hideTimer: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      if (hideTimer) clearTimeout(hideTimer);
      overlay.classList.add('overlay-scrolling');
      
      hideTimer = setTimeout(() => {
        overlay.classList.remove('overlay-scrolling');
      }, 3000);
    };

    overlay.addEventListener('scroll', handleScroll);
    return () => {
      overlay.removeEventListener('scroll', handleScroll);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [currentView]);

  return (
    <div className={styles.dashboard}>
      {/* Header with logo, app name, welcome message and profile */}
      <div className={styles.header}>
        <div className={styles.logoSection}>
          <img src="/assets/images/logo.png" alt="FridgeMate" className={styles.logo} />
          <span className={styles.appName}>FridgeMate</span>
        </div>
        <div className={styles.userInfo}>
          <h1 className={styles.welcomeText}>
            Welcome back, <span className={styles.userName}>{user.name}</span> 👋
          </h1>
        </div>

        <div className={styles.headerActions}>
          {/* Chat Button */}
          <button
            className={styles.chatButton}
            onClick={() => setIsUserListOpen(true)}
            title="Chat"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>

          {/* Profile Menu Button */}
          <div className={styles.menuContainer} ref={menuRef}>
            <button
              className={styles.profileMenuButton}
              onClick={() => setShowMenu(!showMenu)}
              title="Menu"
            >
              {user.profilePicture ? (
                <img 
                  src={user.profilePicture} 
                  alt={user.name} 
                  className={styles.profileMenuImage}
                />
              ) : (
                <div className={styles.profileMenuPlaceholder}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
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
        {activeTab === 'myFridge' && <MyFridgeTab ref={myFridgeTabRef} />}
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
       <SettingsScreen 
  onBack={handleBack}
  onScanComplete={() => {
    setShowScanToast(true);
    setTimeout(() => setShowScanToast(false), 3000);
    // Refresh My Fridge Tab data when scan completes successfully
    myFridgeTabRef.current?.loadItems();
  }}/>
        </div>
      )}

      {/* Chat Components */}
      {isUserListOpen && currentUserId && (
        <UserListPage
          currentUserId={currentUserId}
          onSelectUser={(id, name) => {
            setChatId(id);
            setChatUserName(name);
            setIsUserListOpen(false);
            setIsChatOpen(true);
          }}
          onClose={() => setIsUserListOpen(false)}
        />
      )}

      {isChatOpen && chatId && currentUserId && (
        <Chat
          chatId={chatId}
          currentUserId={currentUserId}
          selectedUserName={chatUserName}
          onClose={() => setIsChatOpen(false)}
          onGoBack={() => { setIsChatOpen(false); setIsUserListOpen(true); }}
        />
      )}
{showScanToast && (
  <div className={styles.scanToast}>
    <FiCheckCircle size={24} />
    <span className={styles.scanToastText}>Items added to your fridge!</span>
  </div>
)}
    </div>
  );
}
