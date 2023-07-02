// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
} from "firebase/auth";
import {
    collection,
    CollectionReference,
    doc,
    DocumentData,
    DocumentSnapshot,
    FirestoreError,
    getFirestore,
    onSnapshot,
    QuerySnapshot,
    setDoc,
} from "firebase/firestore";
import {
    ClassSwapRequest,
    ExtendedUser,
    ModuleWithClassDB,
    SwapReplyRequest,
} from "../types/types";
import { convertDayToAbbrev } from "./functions";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBWfVrRvQzhZGlvYs8qtrislb-79E7qLD4",
    authDomain: "tutreg-9d91c.firebaseapp.com",
    projectId: "tutreg-9d91c",
    storageBucket: "tutreg-9d91c.appspot.com",
    messagingSenderId: "638563662561",
    appId: "1:638563662561:web:a583ce00fc9ca859a255a0",
    measurementId: "G-1PQ1WVQD07",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const fireDb = getFirestore(app);
const auth = getAuth(app);

export const COLLECTION_NAME = "requests";

// Sign in
const adminUser = process.env.ADMIN_USER;
const adminPassword = process.env.ADMIN_PASSWORD;
export const signIn = async () => {
    if (!adminUser || !adminPassword) return false;
    try {
        await signInWithEmailAndPassword(auth, adminUser, adminPassword);

        // make a sample
        const dbRef = doc(fireDb, "test", "123");
        await setDoc(dbRef, { name: "test" });

        return true;
    } catch (e) {
        console.log("Admin account not found. Creating admin account...");
        try {
            await createUserWithEmailAndPassword(
                auth,
                adminUser,
                adminPassword
            );
        } catch (e) {
            console.log("Admin account could not be created!.");
            return false;
        }
    }
};

export const addCollectionListener = (onUpdate: {
    next?: ((snapshot: QuerySnapshot<DocumentData>) => void) | undefined;
    error?: ((error: FirestoreError) => void) | undefined;
    complete?: (() => void) | undefined;
}) => {
    const d = collection(fireDb, COLLECTION_NAME);
    return onSnapshot(d, onUpdate);
    // doc(documentPath).onSnapshot(onUpdate);
};

const ROOT_URL = process.env.ROOT_URL;
export const buildMessage = (
    swapReplyRequest: SwapReplyRequest,
    swap: ClassSwapRequest,
    otherRequestor: ExtendedUser,
    otherClasses: ModuleWithClassDB[],
    creatorClasses: ModuleWithClassDB[]
) => {
    let header = `❗️ <a href='${ROOT_URL}swap/${swap.swapId}'><b>Swap request update</b></a> ❗️\n\nHi ${swap.first_name},\n\n`;

    header += `<a href='t.me/${otherRequestor.username}'>${otherRequestor.first_name}</a> has requested to swap their\n<b><a href="https://nusmods.com/courses/${swapReplyRequest.requested.moduleCode}">${swapReplyRequest.requested.moduleCode}</a> ${swapReplyRequest.requested.lessonType} 「${swapReplyRequest.requested.classNo}」</b>\n`;

    otherClasses.forEach((c, i) => {
        header += `${
            i !== otherClasses.length - 1 ? "├" : "└"
        } ${convertDayToAbbrev(c.day)} ${c.startTime} — ${c.endTime} @ ${
            c.venue
        }\n`;
    });

    header += `\n`;

    header += `for your\n\n`;
    header += `<b><a href="https://nusmods.com/courses/${swapReplyRequest.requested.moduleCode}">${swap.moduleCode}</a> ${swap.lessonType}「${swap.classNo}」</b>\n`;
    creatorClasses.forEach((c, i) => {
        header += `${
            i !== otherClasses.length - 1 ? "├" : "└"
        } ${convertDayToAbbrev(c.day)} ${c.startTime} — ${c.endTime} @ ${
            c.venue
        }\n`;
    });

    header += `\n`;

    header += `Contact them <a href='t.me/${otherRequestor.username}'> here </a> to discuss further.\n\n`;
    return header;
};
