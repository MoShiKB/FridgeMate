import React, { useState, useEffect, useRef } from 'react';
import { connectSocket } from '../../utils/socket';
import styles from '../../styles/Chat.module.css';

interface MessageSender {
  _id: string;
  displayName: string;
  profileImage?: string;
}

interface Message {
  _id: string;
  sender: MessageSender | string;
  content: string;
  status: string;
  createdAt: string;
}

interface ChatProps {
  chatId: string;
  currentUserId: string;
  selectedUserName: string;
  onClose: () => void;
  onGoBack: () => void;
}

function getSenderId(sender: any): string {
  if (typeof sender === 'string') return sender;
  return sender.id || sender._id || '';
}

export const Chat: React.FC<ChatProps> = ({
  chatId,
  currentUserId,
  selectedUserName,
  onClose,
  onGoBack,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = connectSocket();

    socket.emit('getMessages', { chatId });

    const onMessages = (fetchedMessages: Message[]) => {
      setMessages(fetchedMessages);
      fetchedMessages.forEach((msg) => {
        if (getSenderId(msg.sender) !== currentUserId && msg.status !== 'read') {
          socket.emit('markAsRead', { chatId, messageId: msg._id });
        }
      });
    };

    const onReceiveMessage = (message: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === message._id)) return prev;
        return [...prev, message];
      });
      if (getSenderId(message.sender) !== currentUserId) {
        socket.emit('markAsRead', { chatId, messageId: message._id });
      }
    };

    const onStatusUpdated = ({ messageId, status }: { messageId: string; status: string }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg._id === messageId ? { ...msg, status } : msg))
      );
    };

    socket.on('messages', onMessages);
    socket.on('receiveMessage', onReceiveMessage);
    socket.on('messageStatusUpdated', onStatusUpdated);

    return () => {
      socket.off('messages', onMessages);
      socket.off('receiveMessage', onReceiveMessage);
      socket.off('messageStatusUpdated', onStatusUpdated);
    };
  }, [chatId, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    const socket = connectSocket();
    socket.emit('sendMessage', { chatId, content: newMessage });
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className={styles.chatWrapper}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onGoBack}>&#8592;</button>
        <div className={styles.headerInfo}>
          <div className={styles.headerAvatar}>{selectedUserName[0]?.toUpperCase()}</div>
          <div className={styles.headerText}>
            <span className={styles.headerName}>{selectedUserName}</span>
            <span className={styles.headerStatus}>Online</span>
          </div>
        </div>
        <button className={styles.closeButton} onClick={onClose}>&times;</button>
      </div>

      <div className={styles.body}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>No messages yet. Say hello!</div>
        )}

        {messages.map((msg, index) => {
          const isMe = getSenderId(msg.sender) === currentUserId;
          const msgDate = formatDate(msg.createdAt);
          const showDate = index === 0 || formatDate(messages[index - 1].createdAt) !== msgDate;

          return (
            <React.Fragment key={msg._id}>
              {showDate && (
                <div className={styles.dateWrapper}>
                  <span className={styles.dateBadge}>{msgDate}</span>
                </div>
              )}
              <div className={`${styles.row} ${isMe ? styles.rowRight : styles.rowLeft}`}>
                <div className={`${styles.bubble} ${isMe ? styles.mine : styles.theirs}`}>
                  <span className={styles.text}>{msg.content}</span>
                  <span className={styles.meta}>
                    {formatTime(msg.createdAt)}
                    {isMe && <span className={styles.check}>{msg.status === 'read' ? ' ✓✓' : ' ✓'}</span>}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.footer}>
        <input
          type="text"
          className={styles.input}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type a message..."
          autoFocus
        />
        <button
          className={`${styles.sendBtn} ${!newMessage.trim() ? styles.sendDisabled : ''}`}
          onClick={handleSend}
          disabled={!newMessage.trim()}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
};
