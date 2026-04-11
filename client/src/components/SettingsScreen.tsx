import { iconProps, styles } from "../styles/SettingsScreen.styles";
import { useEffect, useState } from "react";
import { FridgeApi } from '../services/api-settings';
/*icons*/
import { IoPeopleOutline ,IoArrowBack} from "react-icons/io5";
import { FiCamera,FiCheckCircle } from "react-icons/fi";
import { TbFridgeOff, TbUpload } from "react-icons/tb";
import { FaRegCopy } from "react-icons/fa";
import { SlLogout } from "react-icons/sl";

{/*texts*/}
const fridgeScannerText ="Upload photos of your fridge contents and we'll automatically detect items and add them to your inventory.";

interface Member {
  userId: string;
  displayName: string;
  profileImage: string | null;
}

function SettingsScreen() {
const [hasFridge, setHasFridge] = useState(false);
const [fridgeName, setFridgeName] = useState(""); 
const [currentFridgeName, setCurrentFridgeName] = useState("");
const [inviteCode, setInviteCode] = useState("");

    const onClick = (index: number) => {
    console.log("clicked index:", index);
  };
const [showCopyToast, setShowCopyToast] = useState(false);
const handleCopyInviteCode = async () => {
  try {
    await navigator.clipboard.writeText(inviteCode);
    setShowCopyToast(true);

    setTimeout(() => {
      setShowCopyToast(false);
    }, 2500);
  } catch (error) {
    console.error("Failed to copy invite code:", error);
  }
};
const [members, setMembers] = useState<Member[]>([]);
useEffect(() => {
  const { request, abort } = FridgeApi.getMyFridge();
  
  request.then((res) => {
    setHasFridge(true);
    setInviteCode(res.data.inviteCode);
    setCurrentFridgeName(res.data.name);
  })
.catch((err) => {
  if (err.name === 'CanceledError') {
    console.log('Request canceled', err.message);
  } else if (err.response?.status === 404) {
    setHasFridge(false);
  } else {
    console.error('Error fetching fridge:', err);
  }
});

  return () => abort();
}, []);
useEffect(() => {
  if (!hasFridge) return;
  
  const { request } = FridgeApi.getMembers();
  request.then((res) => {
    const data = res.data;
setMembers(data.items || []);
  })
  .catch((err) => console.error('Error fetching members:', err));
}, [hasFridge]);
const handleCreateFridge = async () => {
  if (!fridgeName.trim()) return;
  try {
    const res = await FridgeApi.createFridge(fridgeName);
    console.log('Create fridge response:', res);
    console.log('Fridge name from res:', res.data.name);
console.log('Full res.data:', JSON.stringify(res.data));
    setInviteCode(res.data.inviteCode);
    setCurrentFridgeName(fridgeName);
    const { request } = FridgeApi.getMembers();
    request.then((membersRes) => {
      console.log('Members response:', membersRes.data);
   const data = membersRes.data;
setMembers(data.items || []);
    });
    
    setHasFridge(true);
  } catch (err) {
    console.error('Error creating fridge:', err);
  }
};
const handleJoinFridge = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!inviteCode.trim()) return;
  try {
    await FridgeApi.joinFridge(inviteCode);
    setHasFridge(true);
  } catch (err) {
    console.error('Error joining fridge:', err);
  }
};
const handleLeaveFridge = async () => {
  try {
    await FridgeApi.leaveFridge();
    setHasFridge(false);
  } catch (err) {
    console.error('Error leaving fridge:', err);
  }
};

  return (
    <div>
    <div style={styles.page}>

      {/* Header */}

      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => window.history.back()}>
          <IoArrowBack {...iconProps.backIcon} />
        </button>
        <h1 style={styles.title}>Settings</h1>
      </div>
      
{/*check if user has fridge*/}
  {hasFridge ? (
<>
{/* Shared Fridge Card */}

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
        <p style={styles.greenCardTitle}>{currentFridgeName}</p>
      </div>
      <span style={styles.membersText}>{members.length} members</span> 
    </div>

     {/* Invite Code */}
    <div style={styles.inviteBox}>
      <div>
        <p style={styles.inviteLabel}>Invite Code</p>
        <p style={styles.inviteCode}>{inviteCode}</p>
      </div>
        <button style={styles.copyBtn} onClick={handleCopyInviteCode}>
                <FaRegCopy {...iconProps.copyIcon} />
                <span style={styles.copyBtnText} >  Copy </span>
              </button>
    </div>
     {/* Members List */}
      {members.map((member) => (
<div key={member.userId} style={styles.memberRow}>
  <div style={styles.memberAvatar}>
    {member.displayName?.[0]}
  </div>
  <span style={styles.memberName}>{member.displayName}</span>
</div>
  ))}
 </div>
 

 {/*leave fridge button*/}
    <button style={styles.leaveBtn} onClick={handleLeaveFridge}>
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
    </>

) : (
  <div>
    {/* No Fridge Card */}
    <div style={styles.card}>
      <div style={styles.menuRow}>
        <TbFridgeOff {...iconProps.fridgeOffIcon} />
        <div style={styles.menuRowText}>No Fridge Yet</div>
      </div>

      <div style={styles.subText}>
        Create a new shared fridge or join one with an invite code.
      </div>

      <form
        onSubmit={(e) => {
          handleJoinFridge(e);
        }}
      >
        <input
          type="text"
          style={styles.input}
          placeholder="Fridge name (e.g. Home Kitchen)"
          value={fridgeName}
          onChange={(e) => setFridgeName(e.target.value)}
        />

        <button
          type="button"
          style={styles.createBtn}
         onClick={handleCreateFridge}
        >
          Create Fridge
        </button>
        <p style={styles.subText}>Or join an existing fridge</p>

        <input
          type="text"
          style={styles.input}
          placeholder="Enter invite code"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
        />

        <button type="submit" style={styles.joinBtn}>
          Join Fridge
        </button>
      </form>
    </div>
  </div>
)
};
  

{/*copy screen toast*/}
    {showCopyToast && (
      <div style={styles.copyToast}>
        <FiCheckCircle style={styles.copyToastIcon} />
        <span style={styles.copyToastText}>
          Invite code copied to clipboard!
        </span>
      </div>
    )}
    </div>
    </div>
  );
} 

export default SettingsScreen;