import { IoPeopleOutline ,IoArrowBack} from "react-icons/io5";
import { FiCamera } from "react-icons/fi";
import { iconProps, styles } from "../styles/SettingsScreen.styles";
import { TbUpload } from "react-icons/tb";

{/*texts*/}
const fridgeScannerText ="Upload photos of your fridge contents and we'll automatically detect items and add them to your inventory.";


function SettingsScreen() {
    const onClick = (index: number) => {
    console.log("clicked index:", index);
  };

  return (
    <div style={styles.page}>

      {/* Header */}

      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => window.history.back()}>
          <IoArrowBack {...iconProps.backIcon} />
        </button>
        <h1 style={styles.title}>Settings</h1>
      </div>
      {/*Shared fridge card*/}   

         <div style={styles.card}>
      <div style={styles.menuRow}>
  <IoPeopleOutline {...iconProps.peopleIcon} />
  <span style={styles.menuRowText}>Shared Fridge</span>
    </div>
  </div>

  {/*fridge scanning card*/}

    <div style={styles.card}>
        <div style={styles.menuRow}>   
            <FiCamera {...iconProps.cameraIcon} />
            <span style={styles.menuRowText}>Fridge Scanner</span>
        </div>
        <p style={styles.cardText}>{fridgeScannerText}</p>
               {/*Scanner Button*/}
              <button style={styles.scannerBtn} onClick={() => console.log("scanning...")}>
                <TbUpload {...iconProps.uploadIcon} />
                <span style={styles.scannerBtnText}>Upload fridge photo </span>
              </button>
   </div>
</div>

  );
}

export default SettingsScreen;