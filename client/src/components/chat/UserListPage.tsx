import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { connectSocket } from '../../utils/socket';
import styles from '../../styles/UserListPage.module.css';

interface User {
  _id: string;
  displayName: string;
  userName?: string;
  profileImage?: string;
  email: string;
}

interface UserListPageProps {
  currentUserId: string;
  onSelectUser: (chatId: string, userName: string) => void;
  onClose: () => void;
}

export const UserListPage: React.FC<UserListPageProps> = ({
  currentUserId,
  onSelectUser,
  onClose,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const allUsers = await api.getUsers();
        const otherUsers = allUsers.filter(
          (user: User) => user._id !== currentUserId
        );
        setUsers(otherUsers);
      } catch (err: any) {
        setError(err.message || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [currentUserId]);

  const handleStartChat = (targetUserId: string, targetUserName: string) => {
    const socket = connectSocket();

    socket.emit('joinChat', { targetUserId });

    socket.once('chatJoined', ({ chatId }: { chatId: string }) => {
      onSelectUser(chatId, targetUserName);
    });

    socket.once('error', (errorMsg: string) => {
      setError(errorMsg);
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Choose a user to chat with</h3>
          <button className={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        </div>

        <div className={styles.userList}>
          {loading && <p className={styles.status}>Loading users...</p>}
          {error && <p className={styles.errorStatus}>{error}</p>}
          {!loading && !error && users.length === 0 && (
            <p className={styles.status}>No other users available.</p>
          )}

          {users.map((user) => (
            <div
              key={user._id}
              className={styles.userCard}
              onClick={() =>
                handleStartChat(user._id, user.displayName || user.userName || user.email)
              }
            >
              <div className={styles.avatar}>
                {user.profileImage ? (
                  <img src={user.profileImage} alt={user.displayName} />
                ) : (
                  <span>{(user.displayName || user.email)[0].toUpperCase()}</span>
                )}
              </div>
              <div className={styles.userInfo}>
                <span className={styles.userName}>
                  {user.displayName || user.userName}
                </span>
                <span className={styles.userEmail}>{user.email}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
