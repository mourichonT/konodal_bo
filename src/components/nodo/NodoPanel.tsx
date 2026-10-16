import { useEffect, useRef, useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ArrowLeft, ArrowUp, History, LoaderCircle, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { useScopedResidences } from "@/hooks/useScopedResidenceIds"
import { useAuth } from "@/lib/auth-context"
import {
  deleteNodoConversation,
  listenNodoConversations,
  listenNodoMessages,
  newNodoConversationId,
  sendNodoMessage,
  type NodoConversation,
  type NodoMessage,
} from "@/lib/nodo"
import { cn } from "@/lib/utils"
import { NodoActionCard } from "./NodoActionCard"
import { NodoIcon } from "./NodoIcon"

const NODO_GREEN = "oklch(38% 0.07 152)"

const SUGGESTIONS = [
  "Quels sinistres sont encore ouverts ?",
  "Quelles interventions sont prévues cette semaine ?",
  "Résume le dernier PV d'assemblée générale",
  "Rédige une communication pour annoncer une coupure d'eau",
]

// Styles du markdown des réponses (listes, tableaux, titres) - pas de
// plugin typography dans ce projet.
const MARKDOWN_CLASS =
  "text-[13.5px] leading-relaxed text-[oklch(24%_0.01_150)] [&_a]:font-semibold [&_a]:text-[oklch(40%_0.09_155)] [&_a]:underline [&_code]:rounded [&_code]:bg-[oklch(95%_0.005_100)] [&_code]:px-1 [&_h1]:mt-3 [&_h1]:mb-1 [&_h1]:text-[15px] [&_h1]:font-extrabold [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-[14.5px] [&_h2]:font-extrabold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:font-bold [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_td]:border [&_td]:border-[oklch(92%_0.005_100)] [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-[oklch(92%_0.005_100)] [&_th]:bg-[oklch(97%_0.004_100)] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"

function formatConversationDate(date: Date | null): string {
  if (!date) return ""
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function NodoPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const uid = user?.uid ?? ""
  const { residences, isUnrestricted, loading: residencesLoading } = useScopedResidences()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<NodoMessage[]>([])
  const [conversations, setConversations] = useState<NodoConversation[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  // Message affiché tout de suite, le temps que le serveur l'enregistre.
  const [optimistic, setOptimistic] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!uid) return
    return listenNodoConversations(uid, setConversations)
  }, [uid])

  useEffect(() => {
    setMessages([])
    if (!uid || !conversationId) return
    return listenNodoMessages(uid, conversationId, (data) => {
      setMessages(data)
      if (data.some((m) => m.role === "user")) setOptimistic(null)
    })
  }, [uid, conversationId])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, optimistic])

  useEffect(() => {
    if (!showHistory) inputRef.current?.focus()
  }, [showHistory, conversationId])

  const lastMessage = messages[messages.length - 1]
  const answering = sending || lastMessage?.status === "streaming"

  async function send(text: string) {
    const message = text.trim()
    if (!message || answering || !uid) return
    const id = conversationId ?? newNodoConversationId(uid)
    setConversationId(id)
    setInput("")
    setOptimistic(message)
    setSending(true)
    try {
      await sendNodoMessage(id, message)
    } catch (error) {
      setOptimistic(null)
      setInput((current) => current || message)
      toast.error(error instanceof Error ? error.message : "Nodo n'a pas pu répondre.")
    } finally {
      setSending(false)
    }
  }

  function startNewConversation() {
    setConversationId(null)
    setOptimistic(null)
    setShowHistory(false)
  }

  async function handleDelete(id: string) {
    try {
      await deleteNodoConversation(uid, id)
      if (id === conversationId) startNewConversation()
    } catch (error) {
      toast.error("Suppression impossible : " + (error instanceof Error ? error.message : String(error)))
    }
  }

  const subtitle = isUnrestricted
    ? "Toutes les résidences"
    : residencesLoading
      ? "…"
      : `${residences.length} résidence${residences.length > 1 ? "s" : ""}`
  const empty = messages.length === 0 && !optimistic

  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[oklch(93%_0.005_100)] bg-[oklch(98.5%_0.003_100)] shadow-[-12px_0_40px_-12px_oklch(20%_0.02_150/0.25)] duration-200 animate-in slide-in-from-right-8 md:w-[max(25vw,420px)]">
      <header className="flex items-center gap-3 border-b border-[oklch(93%_0.005_100)] bg-white px-4 py-3">
        {showHistory ? (
          <button
            type="button"
            aria-label="Retour à la conversation"
            onClick={() => setShowHistory(false)}
            className="flex size-9 items-center justify-center rounded-lg text-[oklch(35%_0.01_150)] hover:bg-[oklch(95%_0.005_100)]"
          >
            <ArrowLeft className="size-5" />
          </button>
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[11px]" style={{ background: NODO_GREEN }}>
            <NodoIcon className="size-[22px]" color="white" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-extrabold text-[oklch(22%_0.01_150)]">
            {showHistory ? "Conversations" : "Nodo"}
          </div>
          <div className="truncate text-xs text-[oklch(52%_0.01_150)]">Assistant IA · {subtitle}</div>
        </div>
        <button
          type="button"
          aria-label="Nouvelle conversation"
          title="Nouvelle conversation"
          onClick={startNewConversation}
          className="flex size-9 items-center justify-center rounded-lg text-[oklch(35%_0.01_150)] hover:bg-[oklch(95%_0.005_100)]"
        >
          <Plus className="size-5" />
        </button>
        {!showHistory && (
          <button
            type="button"
            aria-label="Historique"
            title="Historique"
            onClick={() => setShowHistory(true)}
            className="flex size-9 items-center justify-center rounded-lg text-[oklch(35%_0.01_150)] hover:bg-[oklch(95%_0.005_100)]"
          >
            <History className="size-5" />
          </button>
        )}
        <button
          type="button"
          aria-label="Fermer Nodo"
          onClick={onClose}
          className="flex size-9 items-center justify-center rounded-lg text-[oklch(35%_0.01_150)] hover:bg-[oklch(95%_0.005_100)]"
        >
          <X className="size-5" />
        </button>
      </header>

      {showHistory ? (
        <div className="flex-1 overflow-y-auto p-3">
          {conversations.length === 0 ? (
            <p className="p-4 text-center text-sm text-[oklch(52%_0.01_150)]">Aucune conversation pour l'instant.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {conversations.map((conversation) => (
                <li key={conversation.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setConversationId(conversation.id)
                      setOptimistic(null)
                      setShowHistory(false)
                    }}
                    className={cn(
                      "min-w-0 flex-1 rounded-[12px] px-3 py-2.5 text-left hover:bg-white",
                      conversation.id === conversationId && "bg-white ring-1 ring-[oklch(90%_0.03_155)]"
                    )}
                  >
                    <div className="truncate text-[13.5px] font-semibold text-[oklch(26%_0.01_150)]">
                      {conversation.title}
                    </div>
                    <div className="text-xs text-[oklch(55%_0.01_150)]">
                      {formatConversationDate(conversation.updatedAt)}
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label="Supprimer la conversation"
                    onClick={() => handleDelete(conversation.id)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[oklch(55%_0.01_150)] opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
            {empty ? (
              <div className="flex h-full flex-col justify-end gap-4">
                <div>
                  <div className="text-lg font-extrabold text-[oklch(22%_0.01_150)]">Bonjour, je suis Nodo.</div>
                  <p className="mt-1 text-[13.5px] text-[oklch(45%_0.01_150)]">
                    Posez-moi une question sur vos résidences, résidents, sinistres, interventions ou documents. Je
                    peux aussi préparer une communication, une intervention ou un mail, que vous confirmerez.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => send(suggestion)}
                      className="rounded-[12px] border border-[oklch(92%_0.006_100)] bg-white px-3 py-2.5 text-left text-[13px] font-medium text-[oklch(30%_0.01_150)] hover:border-[oklch(85%_0.05_155)]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((message) =>
                  message.role === "user" ? (
                    <UserBubble key={message.id} text={message.text} />
                  ) : (
                    <div key={message.id} className="flex flex-col">
                      {message.text && (
                        <div className={MARKDOWN_CLASS}>
                          <Markdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              table: (props) => (
                                <div className="my-2 overflow-x-auto">
                                  <table className="w-full border-collapse text-[12.5px]" {...props} />
                                </div>
                              ),
                              a: (props) => <a target="_blank" rel="noreferrer" {...props} />,
                            }}
                          >
                            {message.text}
                          </Markdown>
                        </div>
                      )}
                      {message.status === "streaming" && (
                        <div className="mt-1 flex items-center gap-2 text-xs font-medium text-[oklch(50%_0.05_155)]">
                          <LoaderCircle className="size-3.5 animate-spin" />
                          {message.activity || "Nodo écrit…"}
                        </div>
                      )}
                      {message.status === "error" && (
                        <div className="mt-1 rounded-[10px] bg-red-50 px-3 py-2 text-xs text-red-700">
                          {message.error || "Nodo n'a pas pu répondre."}
                        </div>
                      )}
                      {message.actions.map((action) => (
                        <NodoActionCard
                          key={action.id}
                          action={action}
                          conversationId={conversationId ?? ""}
                          messageId={message.id}
                        />
                      ))}
                    </div>
                  )
                )}
                {optimistic && (
                  <>
                    <UserBubble text={optimistic} />
                    <div className="flex items-center gap-2 text-xs font-medium text-[oklch(50%_0.05_155)]">
                      <LoaderCircle className="size-3.5 animate-spin" />
                      Nodo réfléchit…
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="border-t border-[oklch(93%_0.005_100)] bg-white p-3"
          >
            <div className="flex items-end gap-2 rounded-[14px] border border-[oklch(90%_0.008_150)] bg-white p-2 focus-within:border-[oklch(45%_0.1_155)]">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                placeholder="Demandez à Nodo…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-[13.5px] text-[oklch(24%_0.01_150)] outline-none [field-sizing:content]"
              />
              <button
                type="submit"
                aria-label="Envoyer"
                disabled={answering || !input.trim()}
                className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-white transition-opacity disabled:opacity-40"
                style={{ background: NODO_GREEN }}
              >
                {answering ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[11px] text-[oklch(58%_0.01_150)]">
              Nodo peut se tromper : vérifiez les informations importantes.
            </p>
          </form>
        </>
      )}
    </aside>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="ml-8 self-end rounded-[16px] rounded-br-[6px] bg-[oklch(38%_0.07_152)] px-3.5 py-2.5 text-[13.5px] whitespace-pre-wrap text-white">
      {text}
    </div>
  )
}
