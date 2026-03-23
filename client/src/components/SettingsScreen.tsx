import { iconProps, styles } from "../styles/SettingsScreen.styles";

/*icons*/
import { IoPeopleOutline ,IoArrowBack} from "react-icons/io5";
import { FiCamera } from "react-icons/fi";
import { TbUpload } from "react-icons/tb";
import { FaRegCopy } from "react-icons/fa";
import { SlLogout } from "react-icons/sl";

{/*texts*/}
const fridgeScannerText ="Upload photos of your fridge contents and we'll automatically detect items and add them to your inventory.";
const members = [
  { name: "Alex Johnson (You)" },
  { name: "Sarah Johnson" },
  { name: "Mike Johnson" },
];

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

    {/*Green card*/}
    <div style={styles.greenCard}> 

      {/*Header and members*/}
    <div style={styles.greenCardHeader}>
      <div>
        <p style={styles.greenCardLabel}>Current Fridge</p>
        <p style={styles.greenCardTitle}>Family Kitchen</p>
      </div>
      <span style={styles.membersText}>3 members</span> {/*TODO:add real data*/}
    </div>

     {/* Invite Code */}
    <div style={styles.inviteBox}>
      <div>
        <p style={styles.inviteLabel}>Invite Code</p>
        <p style={styles.inviteCode}>FRIDGE-2024-XY7K</p> {/*TODO:add real data*/}
      </div>
        <button style={styles.copyBtn} onClick={() => console.log("copying...")}>
                <FaRegCopy {...iconProps.copyIcon} />
                <span style={styles.copyBtnText} >  Copy </span>
              </button>
    </div>
     {/* Members List */}
    {members.map((member) => (
      <div key={member.name} style={styles.memberRow}>
        <div style={styles.memberAvatar}>
          {member.name[0]}
        </div>
        <span style={styles.memberName}>{member.name}</span>
      </div>
    ))}
 </div>

 {/*leave fridge button*/}
    <button style={styles.leaveBtn} onClick={() => console.log("leaving fridge...")}>
         <SlLogout {...iconProps.leaveIcon} />
                <span style={styles.scannerBtnText}>Leave Fridge</span>
    </button>
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