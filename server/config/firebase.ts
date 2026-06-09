import * as admin from 'firebase-admin';
import path from 'path';

let firebaseApp: admin.app.App | undefined;

export const initFirebase = () => {
    if (firebaseApp) return firebaseApp;

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!serviceAccountPath) {
        console.warn("FIREBASE_SERVICE_ACCOUNT_PATH is not set in environment. Push notifications will be disabled.");
        return undefined;
    }

    try {
        const fullPath = path.resolve(process.cwd(), serviceAccountPath);
        const serviceAccount = require(fullPath);

        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        console.log("Firebase Admin SDK initialized successfully");
        return firebaseApp;
    } catch (error) {
        console.error("Failed to initialize Firebase Admin SDK:", error);
        return undefined;
    }
};

export const getFirebaseApp = () => firebaseApp;
