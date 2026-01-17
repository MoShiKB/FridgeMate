import "express";

declare global {
  namespace Express {
    interface User {
      email?: string;
      userName?: string;
      profileImage?: string;
    }
  }
}

export {};
