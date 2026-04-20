import { iconProps, styles } from "../styles/MyProfileScreen.styles";
import { FiCheckCircle, IoArrowBack, IoPersonOutline } from "./icons";
import { useEffect, useRef, useState } from "react";
import { Chat, UserListPage } from "./chat";
import { tokenManager } from "../services/api";
import { ProfileApi } from "../services/api-profile";
import axios from "axios";
const dietOptions = [
  { label: "None", emoji: "" },
  { label: "Vegetarian", emoji: "🥘" },
  { label: "Vegan", emoji: "🌱" },
  { label: "Pescatarian", emoji: "🐟" },
];
const allergyOptions = [
  "Peanuts",
  "Tree Nuts", 
  "Dairy",
  "Eggs",
  "Soy",
  "Wheat/Gluten",
  "Fish",
  "Shellfish",
  "Sesame",
];

function getUserIdFromToken(): string | null {
  const token = tokenManager.getAccessToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1])).userId || null;
  } catch {
    return null;
  }
}

interface MyProfileScreenProps {
  onBack?: () => void;
}

function MyProfileScreen({ onBack = () => window.history.back() }: MyProfileScreenProps) {
  const [selectedDiet, setSelectedDiet] = useState(0);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState("");
  const [location, setLocation] = useState("");
  const [isUserListOpen, setIsUserListOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatId, setChatId] = useState("");
  const [chatUserName, setChatUserName] = useState("");
  const currentUserId = getUserIdFromToken();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [img,setImg] = useState<string | null>(null);
useEffect(() => {
  if (!currentUserId) return;

  setIsLoading(true);

  const { request, abort } = ProfileApi.getMyProfile(currentUserId);

  request.then((res) => {
    setFullName(res.data.displayName || '');
    setSelectedAllergies(res.data.allergies || []);
    setIsLoading(false);
    if (res.data.profileImage) setAvatarUrl(res.data.profileImage);
    const dietIndex = dietOptions.findIndex(d => d.label.toUpperCase() === res.data.dietPreference);
    setSelectedDiet(dietIndex >= 0 ? dietIndex : 0);

    if (res.data.address?.city) {
      setLocation(res.data.address.city);
    } else {
      navigator.geolocation?.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        axios.get(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`)
          .then(r => setLocation(r.data.city || r.data.locality || ''))
          .catch(() => {});
      });
    }
  })
  .catch((err) => {
    if (err.name === 'CanceledError') {
      return;
    } else {
      console.error('Failed to load profile:', err);
      setIsLoading(false);
    }
  });

  return () => {
    abort();
  };
}, []);
const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  setAvatarUrl(url);

  const { request } = ProfileApi.uploadAvatar(file);
  request.then((res) => {
    const imageUrl = res.data.data.imageUrl; 
    return ProfileApi.updateMyProfile(currentUserId!, { profileImage: imageUrl }).then(() => imageUrl);
  })
    .then((uploadedImageUrl) => {
      setAvatarUrl(uploadedImageUrl);
    })
    .catch((err) => {
      console.error('Failed to upload avatar:', err);
    });
};


  const onClick = (index: number) => {
    console.log("clicked index:", index);
    setSelectedDiet(index);
  };
const onAllergyClick = (label: string) => {
  setSelectedAllergies((prev) =>
    prev.includes(label)
      ? prev.filter((a) => a !== label)  
      : [...prev, label]             
  );
};
const onSave = async () => {
  if (!currentUserId) return;
  try {
    const dataToSend: any = {
      dietPreference: dietOptions[selectedDiet].label.toUpperCase(),
      allergies: selectedAllergies,
    };
    if (fullName.trim()) dataToSend.displayName = fullName.trim();
    if (location.trim()) dataToSend.address = { city: location.trim() };
    await ProfileApi.updateMyProfile(currentUserId, dataToSend);
     setShowSaveToast(true);
         setTimeout(() => {
      setShowSaveToast(false);
    }, 2500);
  } catch (err) {
    console.error('Failed to save profile:', err);
  }
};
if (isLoading) return (
  <div style={styles.spinnerWrapper}>
    <div style={styles.spinner} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);
  return (
    <div style={styles.page}>
  {error && <div style={styles.error}>{error}</div>}
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>
          <IoArrowBack {...iconProps.backIcon} />
        </button>
        <h1 style={styles.title}>My Profile</h1>
      </div>

    {/* Profile Picture Card */}
<div style={styles.card}>
  <div style={styles.avatarWrapper}>

    <div style={styles.avatarCircle}>
{avatarUrl
  ? <img src={avatarUrl} alt="profile" style={styles.avatarImg} />
  : <IoPersonOutline size={80} color="#bbb" />
}
    </div>

    <button style={styles.cameraBtn} onClick={() => fileInputRef.current?.click()}>
      📷
    </button>

    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      style={{ display: "none" }}
      onChange={onImageChange}
    />

  </div>
</div>
{/* Personal Information Card */}
<div style={styles.card}>
  <h2 style={styles.cardTitle}>Personal Information</h2>

  <label style={styles.label}>Full Name</label>
  <input
    style={styles.input}
    value={fullName}
    onChange={(e) => setFullName(e.target.value)}
    placeholder="Enter your name"
  />

<label style={styles.label}>📍 Location</label>
<div style={{ display: 'flex', gap: 8 }}>
  <input
    style={styles.input}
    value={location}
    onChange={(e) => setLocation(e.target.value)}
    placeholder="Location"/>
  </div>
</div>
      {/* Dietary Preferences Card */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Dietary Preferences</h2>
        {dietOptions.map((option, index) => (
          <div
            key={index}
            style={styles.radioRow}
            onClick={() => onClick(index)}
          >
            <input
              type="radio"
              name="diet"
              checked={selectedDiet === index}
              onChange={() => onClick(index)}
            />
            <span style={styles.radioLabel}>
              {option.label} {option.emoji}
            </span>
          </div>
        ))}
      </div>

{/* Allergies and Restrictions Card */}
<div style={styles.card}>
  <h2 style={styles.cardTitle}>Allergies & Restrictions</h2>
  {allergyOptions.map((label) => (
<div key={label} style={styles.radioRow}>
  <input
    type="checkbox"
    checked={selectedAllergies.includes(label)}
    onChange={() => onAllergyClick(label)}
  />
  <span 
    style={styles.radioLabel}
    onClick={() => onAllergyClick(label)}
  >
    {label}
  </span>
</div>
  ))}
</div>

{/* Save Button */}
      <button style={styles.saveBtn} onClick={onSave}>
        Save Changes
      </button>
    {/*save screen toast*/}
        {showSaveToast && (
          <div style={styles.saveToast}>
            <FiCheckCircle style={styles.saveToastIcon} />
            <span style={styles.saveToastText}>
              Changes saved successfully!
            </span>
          </div>
        )}
{/* Chat Button */}
      <button style={styles.chatBtn} onClick={() => setIsUserListOpen(true)}>
        💬 Open Chat with Others
      </button>

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
    </div>
  );
}

export default MyProfileScreen;