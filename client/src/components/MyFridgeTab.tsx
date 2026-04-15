import React from 'react';
import styles from '../styles/MyFridgeTab.module.css';

interface FridgeItem {
  id: string;
  name: string;
  quantity: string;
  category: string;
  isLowStock: boolean;
}

// Mock data - replace with API call later
const MOCK_FRIDGE_ITEMS: FridgeItem[] = [
  { id: '1', name: 'Chicken Breast', quantity: '500g', category: 'Protein', isLowStock: false },
  { id: '2', name: 'Eggs', quantity: '4 units', category: 'Protein', isLowStock: false },
  { id: '3', name: 'Milk', quantity: '200ml', category: 'Dairy', isLowStock: true },
  { id: '4', name: 'Cheddar Cheese', quantity: '250g', category: 'Dairy', isLowStock: false },
  { id: '5', name: 'Spinach', quantity: '100g', category: 'Vegetables', isLowStock: true },
  { id: '6', name: 'Tomatoes', quantity: '6 units', category: 'Vegetables', isLowStock: false },
];

export function MyFridgeTab() {
  // Get running low items
  const runningLowItems = MOCK_FRIDGE_ITEMS.filter((item) => item.isLowStock);

  // Group items by category
  const groupedByCategory = MOCK_FRIDGE_ITEMS.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, FridgeItem[]>
  );

  const categories = Object.keys(groupedByCategory).sort();

  const WarningIconSVG = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
    </svg>
  );

  return (
    <div className={styles.myFridgeTab}>
      {/* Running Low Section */}
      {runningLowItems.length > 0 && (
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
                {runningLowItems.map((item) => item.name).join(', ')}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Items by Category Section */}
      {categories.length > 0 ? (
        <div className={styles.itemsSection}>
          {categories.map((category) => (
            <div key={category} className={styles.categorySection}>
              <h3 className={styles.categoryHeader}>{category}</h3>
              <div className={styles.categoryItemsList}>
                {groupedByCategory[category].map((item, index) => (
                  <div key={item.id} className={`${styles.itemCard} ${item.isLowStock ? styles.lowStock : ''}`}>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemNameWrapper}>
                        <p className={styles.itemName} title={item.name}>
                          {item.name}
                        </p>
                        {item.isLowStock && (
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
      ) : (
        /* Empty State */
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>🧊</div>
          <h3 className={styles.emptyStateTitle}>Your fridge is empty</h3>
          <p className={styles.emptyStateDescription}>
            No items in your fridge yet
          </p>
        </div>
      )}
    </div>
  );
}
