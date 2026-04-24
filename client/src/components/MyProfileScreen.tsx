import { iconProps, styles } from "../styles/MyProfileScreen.styles";
import { FiCheckCircle, IoArrowBack, IoPersonOutline, FiCamera } from "./icons";
import { useEffect, useRef, useState } from "react";
import { tokenManager } from "../services/api";
import { ProfileApi } from "../services/api-profile";
import '../styles/MyProfileScreen.module.css';

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
  const [email, setEmail] = useState("");
  const currentUserId = getUserIdFromToken();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSaveToast, setShowSaveToast] = useState(false);

useEffect(() => {
  if (!currentUserId) return;

  setIsLoading(true);

  const { request, abort } = ProfileApi.getMyProfile(currentUserId);

  request.then((res) => {
    setFullName(res.data.displayName || '');
    setEmail(res.data.email || '');
    setSelectedAllergies(res.data.allergies || []);
    setIsLoading(false);
    if (res.data.profileImage) setAvatarUrl(res.data.profileImage);
    const dietIndex = dietOptions.findIndex(d => d.label.toUpperCase() === res.data.dietPreference);
    setSelectedDiet(dietIndex >= 0 ? dietIndex : 0);
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
    await ProfileApi.updateMyProfile(currentUserId, dataToSend);
    setShowSaveToast(true);
    setTimeout(() => {
      onBack();
    }, 400);
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

    {/* Two Column Section: Personal Info + Dietary Preferences */}
    <div style={styles.twoColumnSection}>
      {/* Personal Information Card with Avatar */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Personal Information</h2>
        <div style={styles.personalInfoCard}>
          {/* Avatar Section */}
          <div style={styles.avatarSection}>
            <div style={styles.avatarWrapper}>
              <div style={styles.avatarCircle}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="profile" style={styles.avatarImg} />
                  : <IoPersonOutline {...iconProps.personIcon} />
                }
              </div>
              <button style={styles.cameraBtn} onClick={() => fileInputRef.current?.click()}>
                <FiCamera {...iconProps.cameraIcon} />
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

          {/* Form Section */}
          <div style={styles.formSection}>
            <div style={styles.formRow}>
              <label style={styles.label}>Full Name</label>
              <input
                style={styles.input}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>

            <div style={styles.formRow}>
              <label style={styles.label}>Email</label>
              <input
                style={styles.input}
                value={email}
                disabled
                placeholder="Email"
              />
            </div>
          </div>
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
    </div>

{/* Allergies and Restrictions Card */}
<div style={styles.card}>
  <h2 style={styles.cardTitle}>Allergies & Restrictions</h2>
  <div style={styles.allergiesGrid}>
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
    </div>
  );
}

export default MyProfileScreen;