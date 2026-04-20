import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FeedApi, Post } from '../services/api-feed';
import styles from '../styles/MapView.module.css';

// Fix default marker icons broken by webpack/CRA bundling
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
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

export function MapView() {
  const [posts, setPosts] = useState<Post[]>([]);
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
        zoom={posts.length === 1 ? 8 : 2}
        className={styles.map}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {posts.map(post => {
          const [lng, lat] = post.location!.coordinates;
          return (
            <Marker key={post._id} position={[lat, lng]}>
              <Popup>
                <div className={styles.popupContent}>
                  <p className={styles.popupAuthor}>{post.authorUserId.displayName}</p>
                  <p className={styles.popupTitle}>{post.title}</p>
                  {post.text && <p className={styles.popupText}>{post.text}</p>}
                  <p className={styles.popupTime}>{timeAgo(post.createdAt)}</p>
                  {post.location?.placeName && (
                    <p className={styles.popupPlace}>📍 {post.location.placeName}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
