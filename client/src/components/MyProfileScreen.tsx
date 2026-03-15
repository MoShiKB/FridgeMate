import { iconProps, styles } from "../styles/MyProfileScreen.styles";
import { IoArrowBack } from "./icons";
import { useState } from "react";

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

function MyProfileScreen() {
  const [selectedDiet, setSelectedDiet] = useState(0);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);

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
    <div
      key={label}
      style={styles.radioRow}
      onClick={() => onAllergyClick(label)}
    >
      <input
        type="checkbox"
        checked={selectedAllergies.includes(label)}
        onChange={() => onAllergyClick(label)}
      />
      <span style={styles.radioLabel}>{label}</span>
    </div>
  ))}
</div>

{/* Save Button */}
      <button style={styles.saveBtn} onClick={() => console.log("saving...")}>
        Save Changes
      </button>

    </div>
  );
}

export default MyProfileScreen;