import { iconProps, styles } from "../styles/SettingsScreen.styles";
import { useEffect, useState } from "react";
import { FridgeApi } from '../services/api-settings';
import { tokenManager } from '../services/api';
import { useRef } from "react";

/*icons*/
import { IoPeopleOutline, IoArrowBack, IoSend, IoClose, FiCamera, FiCheckCircle, FiAlertCircle, TbFridgeOff, 
  TbUpload, FaRegCopy, SlLogout } from "./icons";
         
const fridgeScannerText ="Upload photos of your fridge contents and we'll automatically detect items and add them to your inventory.";

interface Member {
  userId: string;
  displayName: string;
  profileImage: string | null;
}

interface SettingsScreenProps {
  onBack?: () => void;
}

function SettingsScreen({ onBack = () => window.history.back() }: SettingsScreenProps) {
const [hasFridge, setHasFridge] = useState(false);
const [fridgeName, setFridgeName] = useState(""); 
const [currentFridgeName, setCurrentFridgeName] = useState("");
const [inviteCode, setInviteCode] = useState("");
const fridgeScanInputRef = useRef<HTMLInputElement>(null);
const [isScanning, setIsScanning] = useState(false);
const [scanSuccessMsg, setScanSuccessMsg] = useState<string | null>(null);
const [scanErrorMsg, setScanErrorMsg] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState(true);
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
    setIsLoading(false);
  })
.catch((err) => {
  if (err.name === 'CanceledError') {
    // Request was canceled
  } else if (err.response?.status === 404) {
    setHasFridge(false);
    setIsLoading(false);
  } else {
    console.error('Error fetching fridge:', err);
    setIsLoading(false);
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
const handleSendScan = async () => {
  if (fridgeImages.length === 0) return;
  setIsScanning(true);
  setScanSuccessMsg(null);
  setScanErrorMsg(null);

  // Track each photo's outcome so we can summarize at the end.
  // The server returns HTTP 201 with { data: { status: 'completed' | 'failed', error? } }
  // even when the scan failed (bad image, AI error, etc.), so success cannot be
  // inferred from HTTP status alone — we must inspect each response body.
  let successCount = 0;
  const failureReasons: string[] = [];

  for (const url of fridgeImages) {
    try {
      const blob = await fetch(url).then(r => r.blob());
      const file = new File([blob], 'fridge.jpg', { type: blob.type });
      const res = await FridgeApi.scanFridge(file);
      const scan = res?.data;

      if (scan?.status === 'completed') {
        successCount += 1;
      } else {
        failureReasons.push(scan?.error || 'Scan failed, please try again.');
      }
    } catch (err) {
      console.error('Scan request failed:', err);
      failureReasons.push('Network error, please check your connection and try again.');
    }
  }

  setFridgeImages([]);
  setIsScanning(false);

  const total = successCount + failureReasons.length;

  if (failureReasons.length === 0) {
    // All succeeded.
    setScanSuccessMsg(
      total === 1
        ? 'Items added to your fridge!'
        : `Items added from ${successCount} photo(s).`
    );
    setTimeout(() => setScanSuccessMsg(null), 2500);
  } else {
    // Build a single summary message for the red toast.
    // If every photo failed for the same reason, show that reason verbatim.
    // Otherwise surface the first reason and note how many photos failed.
    const uniqueReasons = Array.from(new Set(failureReasons));
    const reason = uniqueReasons.length === 1
      ? uniqueReasons[0]
      : failureReasons[0];

    const message = successCount > 0
      ? `Added items from ${successCount} photo(s). ${failureReasons.length} couldn't be scanned: ${reason}`
      : failureReasons.length === 1
        ? reason
        : `${failureReasons.length} photos couldn't be scanned: ${reason}`;

    setScanErrorMsg(message);
    setTimeout(() => setScanErrorMsg(null), 4500);
  }
};
if (isLoading) return (
  <div style={styles.spinnerWrapper}>
    <div style={styles.spinner} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);
  return (
    <div>
    <div style={styles.page}>

      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>
          <IoArrowBack {...iconProps.backIcon} />
        </button>
        <h1 style={styles.title}>Settings</h1>
      </div>
      
{/*check if user has fridge*/}
  {hasFridge ? (
<>
  <div style={styles.cardsContainer}>
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
          <div style={styles.membersGrid}>
            {members.map((member) => (
      <div key={member.userId} style={styles.memberRow}>
       <div style={styles.memberAvatar}>
        {member.profileImage 
          ? <img src={member.profileImage} alt={member.displayName} style={styles.memberAvatarImg} />
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
    onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
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
        <IoClose {...iconProps.closeIcon} />
        </button>
      </div>
    ))}
 <button style={styles.sendScanBtn} onClick={handleSendScan}>
{isScanning ? '...' : <IoSend {...iconProps.sendIcon} />}
</button>
  </div>
)}
{/*scan success toast*/}
{scanSuccessMsg && (
  <div style={styles.copyToast}>
    <FiCheckCircle style={styles.copyToastIcon} />
    <span style={styles.copyToastText}>
      {scanSuccessMsg}
    </span>
  </div>
)}

{/*scan error toast — surfaces server-provided BAD_SCAN_IMAGE / AI error message*/}
{scanErrorMsg && (
  <div style={styles.errorToast}>
    <FiAlertCircle style={styles.errorToastIcon} />
    <span style={styles.errorToastText}>
      {scanErrorMsg}
    </span>
  </div>
)}
</div>
  </div>
</>
) : (
  <div style={styles.singleCardContainer}>
    {/* No Fridge Card */}
    <div style={{...styles.card, maxWidth: "500px"}}>
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