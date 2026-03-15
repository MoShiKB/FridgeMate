
import { iconProps, styles } from "../styles/MyProfileScreen.styles";
import { IoArrowBack } from "./icons";
import { useState } from "react";
function MyProfileScreen() {
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
          {/* Placeholder for profile picture and upload functionality */}
        </div>
        
        {/*Personal Information Card */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Personal Information</h2>
          {/* Placeholder for personal information fields */}
        </div>

        {/* Dietary Preferences Card */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Dietary Preferences</h2>
          {/* Placeholder for dietary preferences fields */}
        </div>

        {/*Allergies and restrictions Card */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Allergies and Restrictions</h2>
          {/* Placeholder for allergies and restrictions fields */}
        </div>
        
      </div>
    );
}

export default MyProfileScreen;