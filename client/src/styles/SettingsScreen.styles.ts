import { CSSProperties } from "react";
import { colors } from "./colors";

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
    color: "#1a1a1a",
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
    borderRadius: 16,
    padding: "20px",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: colors.black,
    marginBottom: 16,
    margin: "0 0 16px 0",
},
};

export const iconProps = {
  backIcon: {
    size: 24,
    color: colors.grayText,
  },
};