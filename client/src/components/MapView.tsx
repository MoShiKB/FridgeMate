import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { FeedApi, Post } from '../services/api-feed';
import { API_BASE_URL } from '../services/api';
import styles from '../styles/MapView.module.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const customMarkerIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width: 28px;
      height: 28px;
      background: #00bc8b;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid #fff;
      box-shadow: 0 3px 10px rgba(0,188,139,0.45);
    "></div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -30],
});

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function LocationMarker({ posts }: { posts: Post[] }) {
  const [index, setIndex] = useState(0);
  const [imgErr, setImgErr] = useState(false);
  const post = posts[index];
  const [lng, lat] = post.location!.coordinates;
  const multi = posts.length > 1;

  useEffect(() => { setImgErr(false); }, [index]);

  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setIndex(i => (i - 1 + posts.length) % posts.length); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setIndex(i => (i + 1) % posts.length); };

  const rawImage = post.mediaUrls?.[0];
  const imageUrl = rawImage
    ? rawImage.startsWith('http') ? rawImage : `${API_BASE_URL}${rawImage}`
    : null;

  const rawAvatar = post.authorUserId.profileImage;
  const avatarUrl = rawAvatar
    ? rawAvatar.startsWith('http') ? rawAvatar : `${API_BASE_URL}${rawAvatar}`
    : null;

  const initial = (post.authorUserId.displayName || '?').charAt(0).toUpperCase();
  const city = post.location?.placeName || post.authorUserId.address?.city;

  return (
    <Marker position={[lat, lng]} icon={customMarkerIcon}>
      <Popup minWidth={360} maxWidth={400} className={styles.leafletPopup}>
        <div className={styles.popupCard}>

          {/* Image - Full width at top */}
          {imageUrl && !imgErr && (
            <img
              src={imageUrl}
              alt={post.title}
              className={styles.popupImage}
              onError={() => setImgErr(true)}
            />
          )}

          <div className={styles.popupContent}>
            {/* User row */}
            <div className={styles.popupUserRow}>
              {avatarUrl ? (
                <img src={avatarUrl} alt={post.authorUserId.displayName} className={styles.popupAvatar} />
              ) : (
                <div className={styles.popupAvatarFallback}>{initial}</div>
              )}
              <div className={styles.popupUserInfo}>
                <span className={styles.popupAuthorName}>{post.authorUserId.displayName}</span>
                {city && <span className={styles.popupCity}>{city}</span>}
              </div>
            </div>

            {/* Title */}
            <p className={styles.popupTitle}>{post.title}</p>

            {/* Description */}
            {post.text && <p className={styles.popupText}>{post.text}</p>}

            {/* Likes & comments */}
            <div className={styles.popupStats}>
              <span className={styles.popupStat}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                {post.likesCount}
              </span>
              <span className={styles.popupStat}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                {post.commentsCount}
              </span>
            </div>
          </div>

          {/* Navigation - Only shown if multiple posts */}
          {multi && (
            <div className={styles.popupNav}>
              <button className={styles.navBtn} onClick={prev} aria-label="Previous post">‹</button>
              <span className={styles.popupCounter}>{index + 1} / {posts.length}</span>
              <button className={styles.navBtn} onClick={next} aria-label="Next post">›</button>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

function FitBounds({ posts }: { posts: Post[] }) {
  const map = useMap();
  useEffect(() => {
    if (posts.length === 0) return;
    if (posts.length === 1) {
      const [lng, lat] = posts[0].location!.coordinates;
      map.setView([lat, lng], 10);
      return;
    }
    const lats = posts.map(p => p.location!.coordinates[1]);
    const lngs = posts.map(p => p.location!.coordinates[0]);
    const bounds = L.latLngBounds(
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    );
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
  }, [posts, map]);
  return null;
}

export function MapView() {  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    FeedApi.getPosts(1, 100)
      .then(data => {
        setPosts(data.items.filter(p => p.location?.coordinates?.length === 2));
        setLoading(false);
      })
      .catch(err => {
        setError(err?.response?.data?.message || err?.message || 'Failed to load posts');
        setLoading(false);
      });
  }, []);

  const locationGroups = useMemo(() => {
    const groups = new Map<string, Post[]>();
    for (const post of posts) {
      const [lng, lat] = post.location!.coordinates;
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(post);
    }
    return Array.from(groups.values());
  }, [posts]);

  const defaultCenter: [number, number] = [20, 10];
  const mapCenter: [number, number] = posts.length > 0
    ? [posts[0].location!.coordinates[1], posts[0].location!.coordinates[0]]
    : defaultCenter;

  return (
    <div className={styles.mapWrapper}>
      {loading && (
        <div className={styles.overlay}>
          <div className={styles.spinner} />
        </div>
      )}
      {error && (
        <div className={styles.overlay}>
          <p className={styles.errorText}>{error}</p>
        </div>
      )}
      {!loading && !error && posts.length === 0 && (
        <div className={styles.emptyOverlay}>
          <span className={styles.emptyIcon}>📍</span>
          <p className={styles.emptyTitle}>No posts with location yet</p>
          <p className={styles.emptyDesc}>Create a post to pin it on the map</p>
        </div>
      )}
      <MapContainer
        center={mapCenter}
        zoom={2}
        className={styles.map}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds posts={posts} />
        {locationGroups.map((group, i) => (
          <LocationMarker key={i} posts={group} />
        ))}
      </MapContainer>
    </div>
  );
}
