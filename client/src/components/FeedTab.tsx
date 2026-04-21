import React, { useEffect, useRef, useState } from 'react';
import Masonry from 'react-masonry-css';
import { tokenManager } from '../services/api';
import { FeedApi, Post, Comment } from '../services/api-feed';
import { API_BASE_URL } from '../services/api';
import { MapView } from './MapView';
import styles from '../styles/FeedTab.module.css';

function getUserIdFromToken(): string | null {
  const token = tokenManager.getAccessToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1])).userId || null;
  } catch {
    return null;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Avatar({ src, name, size = 32 }: { src?: string; name?: string; size?: number }) {
  const [err, setErr] = useState(false);
  const label = name || '?';
  if (src && !err) {
    const fullSrc = src.startsWith('http') ? src : `${API_BASE_URL}${src}`;
    return (
      <img
        src={fullSrc}
        alt={label}
        className={styles.avatar}
        style={{ width: size, height: size }}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div className={styles.avatarFallback} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {label.charAt(0).toUpperCase()}
    </div>
  );
}

interface PostCardProps {
  post: Post;
  currentUserId: string | null;
  onDeleted: (postId: string) => void;
}

function PostCard({ post, currentUserId, onDeleted }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [liking, setLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentsCount);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [imageErr, setImageErr] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    if (showMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const handleToggleComments = async () => {
    if (!showComments && !commentsLoaded) {
      try {
        const data = await FeedApi.getComments(post._id);
        setComments(data.items);
        setCommentsLoaded(true);
      } catch (err: any) {
        console.error('[comments] load failed:', err?.response?.data || err?.message);
      }
    }
    setShowComments(v => !v);
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const newComment = await FeedApi.addComment(post._id, commentText.trim());
      setComments(prev => [...prev, newComment]);
      setCommentCount(c => c + 1);
      setCommentText('');
    } catch (err: any) {
      console.error('[comment] add failed:', err?.response?.data || err?.message);
    }
    setSubmitting(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await FeedApi.deleteComment(post._id, commentId);
      setComments(prev => prev.filter(c => c._id !== commentId));
      setCommentCount(c => c - 1);
    } catch {}
  };

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    const prevLiked = isLiked;
    const prevCount = likesCount;
    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);
    try {
      const res = await FeedApi.toggleLike(post._id);
      setIsLiked(res.liked);
      setLikesCount(res.likesCount);
    } catch (err: any) {
      console.error('[like] failed:', err?.response?.data || err?.message);
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
    } finally {
      setLiking(false);
    }
  };

  const handleDeletePost = async () => {
    try {
      await FeedApi.deletePost(post._id);
      onDeleted(post._id);
    } catch {}
    setShowMenu(false);
  };

  const imageUrl = post.mediaUrls?.[0] || (post.recipeId?.imageUrl && !post.recipeId.imageUrl.startsWith('http') ? post.recipeId.imageUrl : null);
  const fullImageUrl = imageUrl
    ? imageUrl.startsWith('http') ? imageUrl : `${API_BASE_URL}${imageUrl}`
    : null;

  return (
    <div className={styles.postCard}>
      <div className={styles.postHeader}>
        <Avatar src={post.authorUserId.profileImage} name={post.authorUserId.displayName} />
        <div className={styles.authorInfo}>
          <span className={styles.authorName}>{post.authorUserId.displayName}</span>
          {(post.location?.placeName || post.authorUserId.address?.city) && (
            <span className={styles.authorLocation}>
              {post.location?.placeName || post.authorUserId.address?.city}
            </span>
          )}
          <span className={styles.postTime}>
            {timeAgo(post.createdAt)}
          </span>
        </div>
        <div className={styles.postMenuContainer} ref={menuRef}>
          <button className={styles.postMenuBtn} onClick={() => setShowMenu(v => !v)}>⋮</button>
          {showMenu && (
            <div className={styles.postMenu}>
              {post.isOwner && (
                <button className={styles.postMenuDelete} onClick={handleDeletePost}>Delete post</button>
              )}
            </div>
          )}
        </div>
      </div>

      {fullImageUrl && !imageErr && (
        <img src={fullImageUrl} alt={post.title} className={styles.postImage} onError={() => { console.error('Image failed to load:', fullImageUrl); setImageErr(true); }} />
      )}

      <div className={styles.postContent}>
        {post.title && <p className={styles.postTitle}>{post.title}</p>}
        <p className={styles.postText}>{post.text}</p>
      </div>

      <div className={styles.postActions}>
        <button
          className={`${styles.actionBtn} ${isLiked ? styles.liked : ''}`}
          onClick={handleLike}
          disabled={liking}
        >
          <svg className={styles.actionIcon} viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span>{likesCount}</span>
        </button>
        <button className={styles.actionBtn} onClick={handleToggleComments}>
          <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>{commentCount}</span>
        </button>
      </div>

      {showComments && (
        <div className={styles.commentsSection}>
          {comments.map(comment => (
            <div key={comment._id} className={styles.commentRow}>
              <Avatar src={comment.authorUserId.profileImage} name={comment.authorUserId.displayName} size={22} />
              <div className={styles.commentBubble}>
                <span className={styles.commentAuthor}>{comment.authorUserId.displayName}</span>
                <span className={styles.commentText}>{comment.text}</span>
              </div>
              {comment.isOwner && (
                <button className={styles.deleteCommentBtn} onClick={() => handleDeleteComment(comment._id)}>✕</button>
              )}
            </div>
          ))}
          <form className={styles.commentForm} onSubmit={handleSubmitComment}>
            <Avatar src={undefined} name={currentUserId ? 'Me' : '?'} size={22} />
            <input
              className={styles.commentInput}
              placeholder="Add a comment…"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              disabled={submitting}
            />
            <button className={styles.commentSubmit} type="submit" disabled={!commentText.trim() || submitting}>
              Post
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

interface CreatePostModalProps {
  onCreated: (post: Post) => void;
  onClose: () => void;
}

async function getLocation(): Promise<{ lat: number; lng: number } | null> {
  // Try precise browser geolocation first
  if (navigator.geolocation) {
    const browserLoc = await new Promise<{ lat: number; lng: number } | null>(resolve => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
        () => resolve(null),
        { timeout: 5000, maximumAge: 60000 }
      );
    });
    if (browserLoc) return browserLoc;
  }
  // Fallback: IP-based approximate location (no permission needed)
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    if (data.latitude && data.longitude) return { lat: data.latitude, lng: data.longitude };
  } catch {}
  return null;
}

function CreatePostModal({ onCreated, onClose }: CreatePostModalProps) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'loading' | 'ready' | 'denied'>('loading');
  const locationRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    getLocation().then(loc => {
      if (loc) { locationRef.current = loc; setLocationStatus('ready'); }
      else setLocationStatus('denied');
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !text.trim() || submitting) return;
    setSubmitting(true);
    // Always use cached location or fetch fresh — regardless of prior status
    const location = locationRef.current ?? await getLocation();
    if (location) locationRef.current = location;
    try {
      const post = await FeedApi.createPost({
        title: title.trim(),
        text: text.trim(),
        ...(location ? { location } : {}),
      });
      onCreated(post);
      onClose();
    } catch {}
    setSubmitting(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modalForm} onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3 className={styles.modalTitle}>New Post</h3>
        <input
          className={styles.createPostInput}
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={100}
          autoFocus
        />
        <textarea
          className={styles.createPostTextarea}
          placeholder="What did you cook? Share your experience…"
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          maxLength={500}
        />
        {locationStatus !== 'denied' && (
          <p className={styles.locationLabel}>
            {locationStatus === 'loading' ? '🔄 Getting your location…' : '📍 Location will be included'}
          </p>
        )}
        <div className={styles.createPostActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button type="submit" className={styles.submitBtn} disabled={!title.trim() || !text.trim() || submitting}>
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
}

type FeedMode = 'all' | 'mine' | 'nearby';

export function FeedTab() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedMode, setFeedMode] = useState<FeedMode>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentUserId = getUserIdFromToken();
  const POSTS_PER_PAGE = 30;

  const loadPosts = (mode: FeedMode, pageNum = 1, append = false) => {
    if (pageNum === 1) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    if (mode === 'mine') {
      FeedApi.getMyPosts()
        .then(data => {
          if (append) {
            setPosts(prev => [...prev, ...data.items]);
          } else {
            setPosts(data.items);
          }
          setHasMore(false);
          if (pageNum === 1) setLoading(false);
          setLoadingMore(false);
        })
        .catch(err => {
          setError(err?.response?.data?.message || err?.message || 'Failed to load');
          if (pageNum === 1) setLoading(false);
          setLoadingMore(false);
        });
      return;
    }

    if (mode === 'nearby') {
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser');
        if (pageNum === 1) setLoading(false);
        setLoadingMore(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          FeedApi.getPosts(pageNum, POSTS_PER_PAGE, { lat: coords.latitude, lng: coords.longitude, radiusKm: 50 })
            .then(data => {
              if (append) {
                setPosts(prev => [...prev, ...data.items]);
              } else {
                setPosts(data.items);
              }
              setHasMore(data.items.length === POSTS_PER_PAGE);
              if (pageNum === 1) setLoading(false);
              setLoadingMore(false);
            })
            .catch(err => {
              setError(err?.response?.data?.message || err?.message || 'Failed to load');
              if (pageNum === 1) setLoading(false);
              setLoadingMore(false);
            });
        },
        () => {
          setError('Location access denied');
          if (pageNum === 1) setLoading(false);
          setLoadingMore(false);
        }
      );
      return;
    }

    FeedApi.getPosts(pageNum, POSTS_PER_PAGE)
      .then(data => {
        if (append) {
          setPosts(prev => [...prev, ...data.items]);
        } else {
          setPosts(data.items);
        }
        setHasMore(data.items.length === POSTS_PER_PAGE);
        if (pageNum === 1) setLoading(false);
        setLoadingMore(false);
      })
      .catch(err => {
        setError(err?.response?.data?.message || err?.message || 'Failed to load feed');
        if (pageNum === 1) setLoading(false);
        setLoadingMore(false);
      });
  };

  useEffect(() => {
    loadPosts('all', 1);
    setPage(1);
  }, []);

  useEffect(() => {
    if (feedMode === 'nearby') return; // Don't add scroll listener to map view
    
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (loadingMore || !hasMore || loading) return;
      
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollTop + clientHeight >= scrollHeight - 500) {
        // User is within 500px of bottom
        const nextPage = page + 1;
        setPage(nextPage);
        loadPosts(feedMode, nextPage, true);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [page, feedMode, loadingMore, hasMore, loading]);

  const handleMapView = () => {
    const next: FeedMode = feedMode === 'nearby' ? 'all' : 'nearby';
    setFeedMode(next);
    setPage(1);
    loadPosts(next, 1);
  };

  const handleMyPosts = () => {
    const next: FeedMode = feedMode === 'mine' ? 'all' : 'mine';
    setFeedMode(next);
    setPage(1);
    loadPosts(next, 1);
  };

  const handlePostCreated = (_post: Post) => {
    setFeedMode('all');
    setPage(1);
    loadPosts('all', 1);
  };

  const handlePostDeleted = (postId: string) => {
    setPosts(cur => cur.filter(p => p._id !== postId));
  };

  return (
    <div 
      ref={scrollContainerRef}
      className={feedMode === 'nearby' ? styles.feedTabMap : styles.feedTab}
      style={{ overflow: feedMode === 'nearby' ? 'hidden' : 'auto', height: '100%' }}
    >
      {/* Filter pill tabs */}
      <div className={styles.pillContainer}>
        <div className={styles.pillTabs}>
          <button
            className={`${styles.pillTab} ${feedMode === 'all' ? styles.pillActive : ''}`}
            onClick={() => { if (feedMode !== 'all') { setFeedMode('all'); setPage(1); loadPosts('all', 1); } }}
          >
            All Posts
          </button>
          <button
            className={`${styles.pillTab} ${feedMode === 'mine' ? styles.pillActive : ''}`}
            onClick={handleMyPosts}
          >
            My Posts
          </button>
          <button
            className={`${styles.pillTab} ${feedMode === 'nearby' ? styles.pillActive : ''}`}
            onClick={handleMapView}
          >
            Map View
          </button>
        </div>
      </div>

      {/* Map view */}
      {feedMode === 'nearby' ? (
        <MapView />
      ) : loading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
        </div>
      ) : error ? (
        <div className={styles.errorState}>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.retryBtn} onClick={() => { setPage(1); loadPosts(feedMode, 1); }}>Try again</button>
        </div>
      ) : posts.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🍽️</div>
          <p>{feedMode === 'mine' ? "You haven't posted anything yet." : 'No posts yet. Be the first to share!'}</p>
        </div>
      ) : (
        <>
          <Masonry
            breakpointCols={{
              default: 2,
              900: 1
            }}
            className={styles.masonryGrid}
            columnClassName={styles.masonryColumn}
          >
            {posts.map(post => (
              <PostCard
                key={post._id}
                post={post}
                currentUserId={currentUserId}
                onDeleted={handlePostDeleted}
              />
            ))}
          </Masonry>
          
          {loadingMore && (
            <div className={styles.loadMoreSpinner}>
              <div className={styles.spinner} />
            </div>
          )}
          
          {!hasMore && posts.length > 0 && (
            <div className={styles.endMessage}>
              <p>You've reached the end!</p>
            </div>
          )}
        </>
      )}

      {/* FAB */}
      <button className={styles.fab} onClick={() => setShowCreateModal(true)}>+</button>

      {/* Create post modal */}
      {showCreateModal && (
        <CreatePostModal
          onCreated={handlePostCreated}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
