import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
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

export const MyFridgeTab = forwardRef(function MyFridgeTab(_, ref) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  useImperativeHandle(ref, () => ({
    loadItems,
  }));

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

      // Store lastScannedAt from fridge data
      setLastScannedAt((fridge as any).lastScannedAt || null);

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
    const normalItems = items.filter(item => !item.isRunningLow);

    return { lowItems, normalItems };
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
          <div className={styles.spinner} />
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
        {/* Last Scanned Info */}
        {lastScannedAt && (
          <div style={{ padding: '6px 16px', fontSize: '12px', color: '#888', borderBottom: '1px solid #f0f0f0' }}>
            last updated on {lastScannedAt}
          </div>
        )}
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>🧊</div>
          <h3 className={styles.emptyStateTitle}>Your fridge is empty</h3>
          <p className={styles.emptyStateDescription}>No items in your fridge yet</p>
        </div>
      </div>
    );
  }

  // Status is 'items'
  const { lowItems, normalItems } = buildFridgeItemList(state.items);
  const allItems = [...lowItems, ...normalItems];

  return (
    <div className={styles.myFridgeTab}>
      {/* Last Scanned Info */}
      {lastScannedAt && (
        <div style={{ padding: '6px 16px', fontSize: '12px', color: '#888', borderBottom: '1px solid #f0f0f0' }}>
          last updated on {lastScannedAt}
        </div>
      )}

      {/* Running Low Alert */}
      {lowItems.length > 0 && (
        <div className={styles.runningLowSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.warningIcon}>
              <WarningIconSVG />
            </div>
            <h2 className={styles.sectionTitle}>
              Running low on {lowItems.length} {lowItems.length === 1 ? 'item' : 'items'}
            </h2>
          </div>
        </div>
      )}

      {/* Items Grid */}
      <div className={styles.itemsGrid}>
        {allItems.map((item) => (
          <div
            key={item.id || item._id}
            className={`${styles.itemCard} ${item.isRunningLow ? styles.lowStock : ''}`}
          >
            <div className={styles.itemHeader}>
              <h3 className={styles.itemName}>{item.name}</h3>
              {item.isRunningLow && (
                <div className={styles.lowStockBadge} title="Running low">
                  <WarningIconSVG />
                </div>
              )}
            </div>
            <div className={styles.itemFooter}>
              <span className={styles.quantityLabel}>Qty</span>
              <span className={styles.quantityValue}>{item.quantity}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

