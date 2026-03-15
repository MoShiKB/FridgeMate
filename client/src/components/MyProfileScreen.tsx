
import { iconProps, styles } from "../styles/MyProfileScreen.styles";
import { IoArrowBack } from "./icons";
function MyProfileScreen() {
  return (
    <div>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => window.history.back()}>
          <IoArrowBack {...iconProps.backIcon} />
        </button>
        <h1 style={styles.title}>My Profile</h1>
      </div>
    </div>
  );
}

export default MyProfileScreen;