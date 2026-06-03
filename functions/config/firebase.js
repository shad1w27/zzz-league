import admin from "firebase-admin";
import {getStorage} from "firebase-admin/storage";

admin.initializeApp();

export const db = admin.database();
export const auth = admin.auth();
export const storage = getStorage();
