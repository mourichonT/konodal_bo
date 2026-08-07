import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth"
import { doc, onSnapshot, updateDoc } from "firebase/firestore"
import { toast } from "sonner"
import { auth, db } from "@/firebase"
import { ensureUserDocument } from "@/lib/users"
import { clearLocalSessionId, getLocalSessionId, setLocalSessionId } from "@/lib/session"

type AuthContextValue = {
  user: User | null
  loading: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  // Mis à true juste avant un login explicite (email ou Google) pour que
  // l'effet ci-dessous sache qu'il doit générer un nouvel id de session -
  // et donc invalider tout autre device déjà connecté avec ce compte -
  // plutôt que réutiliser l'id déjà en localStorage (cas d'un simple refresh
  // de page sur une session déjà ouverte).
  const freshLoginRef = useRef(false)

  useEffect(() => {
    let unsubscribeSession: (() => void) | undefined

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribeSession?.()
      unsubscribeSession = undefined
      setUser(firebaseUser)
      setLoading(false)
      if (!firebaseUser) return

      await ensureUserDocument(firebaseUser)

      // Une seule session active par compte, tous devices confondus : cf.
      // src/lib/session.ts pour le détail du stockage local. Le dernier
      // login (sur n'importe quel device) écrit son id dans
      // users/{uid}.activeSessionId, ce qui fait échouer la comparaison
      // ci-dessous sur tout autre device déjà connecté et le déconnecte.
      const forceNewSession = freshLoginRef.current
      freshLoginRef.current = false
      let sessionId = forceNewSession ? null : getLocalSessionId(firebaseUser.uid)
      if (!sessionId) {
        sessionId = crypto.randomUUID()
        setLocalSessionId(firebaseUser.uid, sessionId)
        await updateDoc(doc(db, "users", firebaseUser.uid), { activeSessionId: sessionId })
      }

      const localSessionId = sessionId
      unsubscribeSession = onSnapshot(doc(db, "users", firebaseUser.uid), (snapshot) => {
        const remoteSessionId = snapshot.data()?.activeSessionId as string | undefined
        if (remoteSessionId && remoteSessionId !== localSessionId) {
          clearLocalSessionId(firebaseUser.uid)
          toast.error("Session terminée : ce compte vient d'être connecté depuis un autre appareil.")
          void signOut(auth)
        }
      })
    })

    return () => {
      unsubscribeAuth()
      unsubscribeSession?.()
    }
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    signInWithEmail: async (email, password) => {
      freshLoginRef.current = true
      await signInWithEmailAndPassword(auth, email, password)
    },
    signUpWithEmail: async (email, password) => {
      freshLoginRef.current = true
      await createUserWithEmailAndPassword(auth, email, password)
    },
    signInWithGoogle: async () => {
      freshLoginRef.current = true
      await signInWithPopup(auth, new GoogleAuthProvider())
    },
    logout: () => signOut(auth),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
