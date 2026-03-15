import { CSSProperties } from "react";

export const styles: Record<string, CSSProperties> = {
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 24px",
    background: "#fff",
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
};

export const iconProps = {
  backIcon: {
    size: 24,
    color: "#333",
  },
};