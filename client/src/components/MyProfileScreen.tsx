import { iconProps, styles } from "../styles/MyProfileScreen.styles";
import { IoArrowBack } from "./icons";
import { useState } from "react";

const dietOptions = [
  { label: "None", emoji: "" },
  { label: "Vegetarian", emoji: "🥘" },
  { label: "Vegan", emoji: "🌱" },
  { label: "Pescatarian", emoji: "🐟" },
];

function MyProfileScreen() {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onClick = (index: number) => {
    console.log("clicked index:", index);
    setSelectedIndex(index);
  };

  return (
    <div style={styles.page}>

      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => window.history.back()}>
          <IoArrowBack {...iconProps.backIcon} />
        </button>
        <h1 style={styles.title}>My Profile</h1>
      </div>

      {/* Profile Picture Card */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Profile Picture</h2>
      </div>

      {/* Personal Information Card */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Personal Information</h2>
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
              checked={selectedIndex === index}
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
        <h2 style={styles.cardTitle}>Allergies and Restrictions</h2>
      </div>

    </div>
  );
}

export default MyProfileScreen;