import { iconProps, styles } from "../styles/SettingsScreen.styles";
import { useEffect, useState } from "react";
import { FridgeApi } from '../services/api-settings';
import { tokenManager } from '../services/api';
import { useRef } from "react";

/*icons*/
import { IoPeopleOutline, IoArrowBack, IoSend, IoClose, FiCamera, FiCheckCircle, FiAlertCircle,
  FiPlusCircle, FiMinusCircle, FiRepeat, TbFridgeOff,
  TbUpload, FaRegCopy, SlLogout } from "./icons";

interface ScanChanges {
  added: { name: string; quantity: string }[];
  updated: { name: string; oldQuantity: string; newQuantity: string }[];
  removed: { name: string; quantity: string }[];
}
         
const fridgeScannerText ="Upload photos of your fridge contents and we'll automatically detect items and add them to your inventory.";

interface Member {
  userId: string;
  displayName: string;
  profileImage: string | null;
}

interface SettingsScreenProps {
  onBack?: () => void;
   onScanComplete?: () => void;
}

function SettingsScreen({ onBack = () => window.history.back(), onScanComplete }: SettingsScreenProps) {
const [hasFridge, setHasFridge] = useState(false);
const [fridgeName, setFridgeName] = useState(""); 
const [currentFridgeName, setCurrentFridgeName] = useState("");
const [inviteCode, setInviteCode] = useState("");
const fridgeScanInputRef = useRef<HTMLInputElement>(null);
const [isScanning, setIsScanning] = useState(false);
const [scanErrorMsg, setScanErrorMsg] = useState<string | null>(null);
// When a scan succeeds we surface the diff via the inline Scan Results panel
// (see JSX below) instead of a transient toast. For multi-photo uploads we show
// the LAST successful scan's diff, since each scan replaces the fridge contents.
const [scanChanges, setScanChanges] = useState<ScanChanges | null>(null);
const [scanPhotoCount, setScanPhotoCount] = useState(0);
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
  setScanErrorMsg(null);
  setScanChanges(null);

  // Track each photo's outcome so we can summarize at the end.
  // The server returns HTTP 201 with { data: { status: 'completed' | 'failed', error? } }
  // even when the scan failed (bad image, AI error, etc.), so success cannot be
  // inferred from HTTP status alone — we must inspect each response body.
  let successCount = 0;
  const failureReasons: string[] = [];
  let lastChanges: ScanChanges | null = null;

  for (const url of fridgeImages) {
    try {
      const blob = await fetch(url).then(r => r.blob());
      const file = new File([blob], 'fridge.jpg', { type: blob.type });
      const res = await FridgeApi.scanFridge(file);
      const scan = res?.data;

      if (scan?.status === 'completed') {
        successCount += 1;
        if (scan.changes) {
          lastChanges = scan.changes as ScanChanges;
        }
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

  if (successCount > 0 && lastChanges) {
    setScanChanges(lastChanges);
    setScanPhotoCount(successCount);
    onScanComplete?.();
  }

  if (failureReasons.length > 0) {
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
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
      <div style={styles.greenCard}>
        <div style={styles.greenCardHeader}>
          <div style={styles.greenCardHeaderLeft}>
            <p style={styles.greenCardLabel}>Current Fridge</p>
            <p style={styles.greenCardTitle}>{currentFridgeName}</p>
          </div>
          <span style={styles.membersBadge}>
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
        </div>

        <div style={styles.inviteBox}>
          <div>
            <p style={styles.inviteLabel}>Invite Code</p>
            <p style={styles.inviteCode}>{inviteCode}</p>
          </div>
          <button style={styles.copyBtn} onClick={handleCopyInviteCode}>
            <FaRegCopy {...iconProps.copyIcon} />
            Copy
          </button>
        </div>

        <p style={styles.sectionLabel}>Members</p>
        <div style={styles.memberPillsContainer}>
          {members.map((member) => (
            <div key={member.userId} style={styles.memberPill}>
              <div style={styles.memberAvatar}>
                {member.profileImage
                  ? <img src={member.profileImage} alt={member.displayName} style={styles.memberAvatarImg} />
                  : member.displayName?.[0]?.toUpperCase()
                }
              </div>
              <span style={styles.memberName}>
                {member.displayName}
                {member.userId === currentUserId && (
                  <span style={styles.memberNameMe}>(You)</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.leaveBtnWrap}>
        <button style={styles.leaveBtn} onClick={handleLeaveFridge}>
          <SlLogout {...iconProps.leaveIcon} />
          Leave Fridge
        </button>
      </div>
    </div>

    {/*fridge scanning card*/}
    <div style={styles.card}>
      <div style={styles.menuRow}>
        <FiCamera {...iconProps.cameraIcon} />
        <span style={styles.menuRowText}>Fridge Scanner</span>
      </div>

      <div style={styles.scannerBody}>
        <p style={styles.scannerSubtitle}>{fridgeScannerText}</p>

        {/* Large drop-zone — fills the card and provides a clear upload
            affordance. Clicking anywhere inside opens the file picker. */}
        <div
          style={styles.dropZone}
          onClick={() => fridgeScanInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fridgeScanInputRef.current?.click();
          }}
        >
          <div style={styles.dropZoneIconWrap}>
            <TbUpload {...iconProps.dropZoneIcon} />
          </div>
          <p style={styles.dropZoneTitle}>Upload fridge photo</p>
          <p style={styles.dropZoneHint}>PNG or JPG · multiple photos supported</p>
        </div>

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
{isScanning ? (
  <div style={styles.scanSpinner} />
) : (
  <IoSend {...iconProps.sendIcon} />
)}
            </button>
          </div>
        )}
      </div>
    </div>
  </div>

  {scanChanges && (() => {
    const { added, updated, removed } = scanChanges;
    const hasAnyChange = added.length > 0 || updated.length > 0 || removed.length > 0;
    return (
      <div style={styles.scanResultsWrap}>
        <div style={styles.scanResultsPanel}>
          <div style={styles.scanResultsHeader}>
            <div style={styles.scanResultsTitleWrap}>
              <div style={styles.scanResultsTitle}>
                <FiCheckCircle {...iconProps.scanResultsTitleIcon} />
                Scan complete
              </div>
              {scanPhotoCount > 1 && (
                <span style={styles.scanResultsSubtitle}>
                  Showing changes from your last photo ({scanPhotoCount} processed)
                </span>
              )}
              {hasAnyChange && (
                <div style={styles.scanResultsCountRow}>
                  {added.length > 0 && (
                    <span style={{ ...styles.scanResultsCountBadge, ...styles.scanResultsCountBadgeAdded }}>
                      +{added.length} added
                    </span>
                  )}
                  {updated.length > 0 && (
                    <span style={{ ...styles.scanResultsCountBadge, ...styles.scanResultsCountBadgeUpdated }}>
                      {updated.length} updated
                    </span>
                  )}
                  {removed.length > 0 && (
                    <span style={{ ...styles.scanResultsCountBadge, ...styles.scanResultsCountBadgeRemoved }}>
                      −{removed.length} removed
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              style={styles.scanResultsClose}
              onClick={() => setScanChanges(null)}
              aria-label="Dismiss scan results"
            >
              <IoClose {...iconProps.scanResultsCloseIcon} />
            </button>
          </div>

          {!hasAnyChange ? (
            <p style={styles.scanResultsEmpty}>
              No changes detected — your fridge looks the same as before.
            </p>
          ) : (
            // Responsive auto-fit grid: 3 columns on desktop, 2 on tablet, 1 on phone.
            // Each section has its own scroll-capped chip container so one huge
            // category can't blow out the whole panel vertically.
            <div style={styles.scanResultsGrid}>
              {added.length > 0 && (
                <div style={{ ...styles.changeSection, ...styles.changeSectionAdded }}>
                  <div style={{ ...styles.changeSectionHeader, ...styles.changeSectionHeaderAdded }}>
                    <FiPlusCircle {...iconProps.scanAddedIcon} />
                    Added · {added.length}
                  </div>
                  <div style={styles.chipContainer}>
                    {added.map((item, i) => (
                      <span key={`added-${i}`} style={styles.chip}>
                        <span style={styles.chipName}>{item.name}</span>
                        <span style={styles.chipQty}>{item.quantity}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {updated.length > 0 && (
                <div style={{ ...styles.changeSection, ...styles.changeSectionUpdated }}>
                  <div style={{ ...styles.changeSectionHeader, ...styles.changeSectionHeaderUpdated }}>
                    <FiRepeat {...iconProps.scanUpdatedIcon} />
                    Updated · {updated.length}
                  </div>
                  <div style={styles.chipContainer}>
                    {updated.map((item, i) => (
                      <span key={`updated-${i}`} style={styles.chip}>
                        <span style={styles.chipName}>{item.name}</span>
                        <span style={styles.chipQtyStrike}>{item.oldQuantity}</span>
                        <span style={styles.chipArrow}>→</span>
                        <span style={styles.chipQty}>{item.newQuantity}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {removed.length > 0 && (
                <div style={{ ...styles.changeSection, ...styles.changeSectionRemoved }}>
                  <div style={{ ...styles.changeSectionHeader, ...styles.changeSectionHeaderRemoved }}>
                    <FiMinusCircle {...iconProps.scanRemovedIcon} />
                    Removed · {removed.length}
                  </div>
                  <div style={styles.chipContainer}>
                    {removed.map((item, i) => (
                      <span key={`removed-${i}`} style={styles.chip}>
                        <span style={styles.chipName}>{item.name}</span>
                        <span style={styles.chipQtyStrike}>{item.quantity}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  })()}

  {/*scan error toast — surfaces server-provided BAD_SCAN_IMAGE / AI error message*/}
  {scanErrorMsg && (
    <div style={styles.errorToast}>
      <FiAlertCircle style={styles.errorToastIcon} />
      <span style={styles.errorToastText}>
        {scanErrorMsg}
      </span>
    </div>
  )}
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