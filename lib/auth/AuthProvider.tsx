"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  linkWithPopup,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth, firebaseEnabled, googleProvider } from "@/lib/firebase";

type AuthState = {
  user: User | null;
  loading: boolean;
  enabled: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  // Attach a Google account to the signed-in (email/password) user.
  linkGoogleAccount: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Only "loading" when there is a configured Firebase project to wait for.
  const [loading, setLoading] = useState(firebaseEnabled);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  async function signInWithGoogle() {
    if (!auth) return;
    await signInWithPopup(auth, googleProvider);
  }

  async function signUpWithEmail(
    email: string,
    password: string,
    displayName?: string,
  ) {
    if (!auth) return;
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const name = displayName?.trim();
    if (name) {
      await updateProfile(credential.user, { displayName: name });
      // updateProfile doesn't re-emit auth state, so refresh the local user.
      setUser({ ...credential.user });
    }
  }

  async function signInWithEmail(email: string, password: string) {
    if (!auth) return;
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function linkGoogleAccount() {
    if (!auth?.currentUser) return;
    await linkWithPopup(auth.currentUser, googleProvider);
    // Linking doesn't re-emit auth state; surface the merged providers/photo.
    setUser(auth.currentUser ? { ...auth.currentUser } : null);
  }

  async function signOutUser() {
    if (!auth) return;
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        enabled: firebaseEnabled,
        signInWithGoogle,
        signUpWithEmail,
        signInWithEmail,
        linkGoogleAccount,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
