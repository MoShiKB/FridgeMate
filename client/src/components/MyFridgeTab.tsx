import React, { useState, useEffect } from 'react';
import styles from '../styles/MyFridgeTab.module.css';
import { FridgeApi, FridgeDto } from '../services/api-fridge';
import { InventoryItemApi, InventoryItemDto } from '../services/api-inventory';
import { tokenManager } from '../services/api';

type State = 
  | { status: 'loading' }
  | { status: 'items'; items: InventoryItemDto[] }
  | { status: 'empty' }
  | { status: 'noFridge' }
  | { status: 'notLoggedIn' }
  | { status: 'error'; message: string };

export function MyFridgeTab() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      if (!tokenManager.getAccessToken()) {
        setState({ status: 'notLoggedIn' });
        return;
      }

      // Get user's fridge
      const fridgeResponse = await FridgeApi.getMyFridge();
      // Response is wrapped in { ok: true, data: {...} }
      const apiData = fridgeResponse.data as any;
      const fridge = apiData.data as FridgeDto;

      if (!fridge) {
        setState({ status: 'noFridge' });
        return;
      }

      // Extract fridge ID (MongoDB returns _id, not id)
      const fridgeId = fridge.id || fridge._id;
      if (!fridgeId) {
        throw new Error('Fridge ID not found');
      }

      // Get items in the fridge
      const itemsResponse = await InventoryItemApi.getItems(fridgeId);
      const items = itemsResponse.data.items;

      if (items.length === 0) {
        setState({ status: 'empty' });
      } else {
        setState({ status: 'items', items });
      }
    } catch (error) {
      console.error('Failed to load fridge items:', error);
      setState({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Failed to load fridge items'
      });
    }
  };

  const buildFridgeItemList = (items: InventoryItemDto[]) => {
    const lowItems = items.filter(item => item.isRunningLow);
    const groupedByCategory: Record<string, InventoryItemDto[]> = {};
    
    items.forEach(item => {
      // Use a generic "Items" category since the API doesn't provide category info
      const category = 'Items';
      if (!groupedByCategory[category]) {
        groupedByCategory[category] = [];
      }
      groupedByCategory[category].push(item);
    });

    return { lowItems, groupedByCategory };
  };

  const WarningIconSVG = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
    </svg>
  );

  if (state.status === 'loading') {
    return (
      <div className={styles.myFridgeTab}>
        <div className={styles.loadingState}>
          <p>Loading fridge...</p>
        </div>
      </div>
    );
  }

  if (state.status === 'notLoggedIn') {
    return (
      <div className={styles.myFridgeTab}>
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>🔓</div>
          <h3 className={styles.emptyStateTitle}>Not logged in</h3>
          <p className={styles.emptyStateDescription}>Please log in to view your fridge</p>
        </div>
      </div>
    );
  }

  if (state.status === 'noFridge') {
    return (
      <div className={styles.myFridgeTab}>
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>🏠</div>
          <h3 className={styles.emptyStateTitle}>No fridge yet</h3>
          <p className={styles.emptyStateDescription}>Create or join a fridge to get started</p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className={styles.myFridgeTab}>
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>⚠️</div>
          <h3 className={styles.emptyStateTitle}>Error loading fridge</h3>
          <p className={styles.emptyStateDescription}>{state.message}</p>
          <button onClick={loadItems} className={styles.retryButton}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (state.status === 'empty') {
    return (
      <div className={styles.myFridgeTab}>
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>🧊</div>
          <h3 className={styles.emptyStateTitle}>Your fridge is empty</h3>
          <p className={styles.emptyStateDescription}>No items in your fridge yet</p>
        </div>
      </div>
    );
  }

  // Status is 'items'
  const { lowItems, groupedByCategory } = buildFridgeItemList(state.items);
  const categories = Object.keys(groupedByCategory).sort();

  return (
    <div className={styles.myFridgeTab}>
      {/* Running Low Section */}
      {lowItems.length > 0 && (
        <div className={styles.runningLowSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.warningIcon}>
              <WarningIconSVG />
            </div>
            <h2 className={styles.sectionTitle}>Running low on ingredients</h2>
          </div>
          <div className={styles.runningLowList}>
            <p className={styles.runningLowText}>
              You need to restock:{' '}
              <span className={styles.itemsList}>
                {lowItems.map(item => item.name).join(', ')}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Items by Category Section */}
      {categories.length > 0 ? (
        <div className={styles.itemsSection}>
          {categories.map(category => (
            <div key={category} className={styles.categorySection}>
              <h3 className={styles.categoryHeader}>{category}</h3>
              <div className={styles.categoryItemsList}>
                {groupedByCategory[category].map((item, index) => (
                  <div
                    key={item.id}
                    className={`${styles.itemCard} ${item.isRunningLow ? styles.lowStock : ''}`}
                  >
                    <div className={styles.itemInfo}>
                      <div className={styles.itemNameWrapper}>
                        <p className={styles.itemName} title={item.name}>
                          {item.name}
                        </p>
                        {item.isRunningLow && (
                          <div className={styles.itemWarningIcon} title="Running low">
                            <WarningIconSVG />
                          </div>
                        )}
                      </div>
                      <p className={styles.itemQuantity}>{item.quantity}</p>
                    </div>
                    {index < groupedByCategory[category].length - 1 && (
                      <div className={styles.divider} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

