import { iconProps, styles } from "../styles/MyProfileScreen.styles";
import { IoArrowBack, IoPersonOutline } from "./icons";
import { useRef, useState } from "react";

function SettingsScreen() {
  return (
    <div style={styles.page}>

      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => window.history.back()}>
          <IoArrowBack {...iconProps.backIcon} />
        </button>
        <h1 style={styles.title}>Settings</h1>
      </div>

    </div>
  );
}

export default SettingsScreen;