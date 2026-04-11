import { iconProps, styles } from "../styles/SettingsScreen.styles";
import { useEffect, useState } from "react";
import { FridgeApi } from '../services/api-settings';
import { tokenManager } from '../services/api';
import { useRef } from "react";
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
const fridgeScanInputRef = useRef<HTMLInputElement>(null);
const [showCopyToast, setShowCopyToast] = useState(false);const currentUserId = tokenManager.getAccessToken() 
  ? JSON.parse(atob(tokenManager.getAccessToken()!.split('.')[1])).userId 
  : null;

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
    setInviteCode(res.data.data.inviteCode);
    setCurrentFridgeName(res.data.data.name);
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
    setInviteCode(res.data.inviteCode);
    setCurrentFridgeName(fridgeName);
    const { request } = FridgeApi.getMembers();
    request.then((membersRes) => {
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
    const { request } = FridgeApi.getMyFridge();
    request.then((res) => {
      setCurrentFridgeName(res.data.data.name);
      setInviteCode(res.data.data.inviteCode);
    });
    // get members
    const { request: membersReq } = FridgeApi.getMembers();
    membersReq.then((res) => {
      setMembers(res.data.items || []);
    });
    setHasFridge(true);
  } catch (err) {
    console.error('Error joining fridge:', err);
  }
};
const handleLeaveFridge = async () => {
  try {
    await FridgeApi.leaveFridge();
    setHasFridge(false);
    setInviteCode('');        
    setCurrentFridgeName('');
    setFridgeName('');
    setMembers([]);           
  } catch (err) {
    console.error('Error leaving fridge:', err);
  }
};
const [fridgeImages, setFridgeImages] = useState<string[]>([]);

const onFridgeScan = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  const urls = files.map(file => URL.createObjectURL(file));
 setFridgeImages(prev => [...prev, ...urls]);
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
  {member.profileImage 
    ? <img src={member.profileImage} alt={member.displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
    : member.displayName?.[0]
  }
</div>
<span style={styles.memberName}>
  {member.displayName}
  {member.userId === currentUserId && ' (Me)'}
</span>
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
  {/*upload button*/}
  <button style={styles.scannerBtn} onClick={() => fridgeScanInputRef.current?.click()}>
    <TbUpload {...iconProps.uploadIcon} />
    <span style={styles.scannerBtnText}>Upload fridge photo</span>
  </button>

  <input
    ref={fridgeScanInputRef}
    type="file"
    accept="image/*"
    multiple
    style={{ display: 'none' }}
    onChange={onFridgeScan}
  />
{fridgeImages.length > 0 && (
  <div style={styles.imagesContainer}>
    {fridgeImages.map((url, index) => (
      <div key={index} style={styles.imageWrapper}>
        <img src={url} alt={`fridge ${index + 1}`} style={styles.imagePreview} />
        <button
          onClick={() => setFridgeImages(prev => prev.filter((_, i) => i !== index))}
          style={styles.imageDeleteBtn}
        >
          ✕
        </button>
      </div>
    ))}
  </div>
)}
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