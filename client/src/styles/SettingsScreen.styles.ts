import { CSSProperties } from "react";
import { colors } from "./colors";
import { TbUpload } from "react-icons/tb";


export const styles: Record<string, CSSProperties> = {
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 24px",
    background:colors.white,
    borderBottom: "1px solid #e0e0e0",
  },
  backBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    padding: 0,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: colors.black,
  },
page: {
  minHeight: "100vh",
  background: colors.lightTeal,
  padding: "16px",     
  display: "flex",
  flexDirection: "column",
  gap: 16,               
},
  card: {
    background: colors.white,
    width: "70%",
    borderRadius: 16,
    padding: "21px",
    margin: "0 auto 24px auto",
    marginBottom: 10,
  },
cardText: {
  fontSize: 15,
  fontWeight: 400,
  color: colors.black,
  marginTop: 10, 
  marginBottom: 16,
  marginLeft: 0,
  marginRight: 0,
  display: "block",
},
menuRow: {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "14px 0",
  borderBottom: "1px solid #f0f0f0",
  cursor: "pointer",
},
menuRowText: {
  fontSize: 18,
  fontWeight: 600,
  color: colors.black,
},

scannerBtn: {
  width: "60%",
  padding: "10px",
  margin: "16px auto 0 auto",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "10px",
  borderRadius: 12,
  border: "none",
  backgroundColor: colors.buttons,
  color: colors.white,
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
}
};

export const iconProps = {
  backIcon: {
    size: 24,
    color: colors.grayText,
  },
  peopleIcon: {
    size: 20,
    color: colors.buttons,
  },
  cameraIcon: {
    size: 17,
    color: colors.buttons,
  },
  uploadIcon: {
    size: 17,
    color: colors.white,
  },

};