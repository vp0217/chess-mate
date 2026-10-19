
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Send,
  MessageCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Swords,
  UserRound,
} from "lucide-react";
import { createClient } from "../utils/supabase/client";

type Player = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  rating: number | null;
};

type Conversation = {
  id: string;
  player_one: string;
  player_two: string;
  created_at: string;
};

type ChatMessage = {
  id: string;
  conversation_id: string | null;
  match_id: string | null;
  sender_id: string;
  body: string;
  created_at: string;
};

export default function MessagesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [userId, setUserId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const initials = (name: string) =>
    name.trim().slice(0, 2).toUpperCase() || "CM";

  const loadConversations = useCallback(async (id: string) => {
    const { data, error: queryError } = await supabase
      .from("direct_conversations")
      .select("id, player_one, player_two, created_at")
      .or(`player_one.eq.${id},player_two.eq.${id}`)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(`Could not load conversations: ${queryError.message}`);
      return;
    }

    setConversations((data ?? []) as Conversation[]);
  }, [supabase]);

  const loadPlayers = useCallback(async (id: string) => {
    const { data, error: queryError } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, rating")
      .neq("id", id)
      .order("username", { ascending: true })
      .limit(100);

    if (queryError) {
      setError(
        `Could not load players. Check your profiles table permissions: ${queryError.message}`
      );
      return;
    }

    setPlayers((data ?? []) as Player[]);
  }, [supabase]);

  const loadMessages = useCallback(async (id: string) => {
    const { data, error: queryError } = await supabase
      .from("chat_messages")
      .select("id, conversation_id, match_id, sender_id, body, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(200);

    if (queryError) {
      setError(`Could not load messages: ${queryError.message}`);
      return;
    }

    setMessages((data ?? []) as ChatMessage[]);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const { data, error: authError } = await supabase.auth.getUser();

      if (cancelled) return;

      if (authError || !data.user) {
        setError("Please sign in to use Chess Mate messages.");
        setLoading(false);
        return;
      }

      const id = data.user.id;
      setUserId(id);

      await Promise.all([loadConversations(id), loadPlayers(id)]);

      if (!cancelled) setLoading(false);
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [supabase, loadConversations, loadPlayers]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    async function refresh() {
      await loadMessages(conversationId);
    }

    void refresh();

    const channel = supabase
      .channel(`direct-chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (event) => {
          const incoming = event.new as ChatMessage;

          if (!cancelled) {
            setMessages((previous) => {
              if (previous.some((message) => message.id === incoming.id)) {
                return previous;
              }
              return [...previous, incoming];
            });
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [conversationId, supabase, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function openConversation(player: Player) {
    if (!userId || player.id === userId) return;

    setError("");
    setNotice("");
    setSelectedPlayer(player);
    setConversationId("");
    setMessages([]);

    // Sort the pair so both players use the same unique conversation.
    const [playerOne, playerTwo] = [userId, player.id].sort();

    const { data: existing, error: findError } = await supabase
      .from("direct_conversations")
      .select("id, player_one, player_two, created_at")
      .eq("player_one", playerOne)
      .eq("player_two", playerTwo)
      .maybeSingle();

    if (findError) {
      setError(`Could not open conversation: ${findError.message}`);
      return;
    }

    if (existing) {
      setConversationId(existing.id);
      await loadConversations(userId);
      return;
    }

    const { data: created, error: createError } = await supabase
      .from("direct_conversations")
      .insert({
        player_one: playerOne,
        player_two: playerTwo,
      })
      .select("id, player_one, player_two, created_at")
      .single();

    if (createError) {
      // Another tab may have created this same conversation first.
      const { data: retry } = await supabase
        .from("direct_conversations")
        .select("id, player_one, player_two, created_at")
        .eq("player_one", playerOne)
        .eq("player_two", playerTwo)
        .maybeSingle();

      if (retry) {
        setConversationId(retry.id);
        await loadConversations(userId);
      } else {
        setError(`Could not start conversation: ${createError.message}`);
      }
      return;
    }

    setConversationId(created.id);
    await loadConversations(userId);
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = draft.trim();

    if (!userId || !conversationId || !body || sending) return;

    if (body.length > 2000) {
      setError("Messages must be 2,000 characters or fewer.");
      return;
    }

    setSending(true);
    setError("");

    // Confirm the signed-in player is a participant before inserting.
    const { data: conversation, error: accessError } = await supabase
      .from("direct_conversations")
      .select("id")
      .eq("id", conversationId)
      .or(`player_one.eq.${userId},player_two.eq.${userId}`)
      .maybeSingle();

    if (accessError || !conversation) {
      setError("You don't have access to this conversation.");
      setSending(false);
      return;
    }

    const { data: sent, error: sendError } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        match_id: null,
        sender_id: userId,
        body,
      })
      .select("id, conversation_id, match_id, sender_id, body, created_at")
      .single();

    if (sendError) {
      setError(`Message not sent: ${sendError.message}`);
    } else {
      setDraft("");
      setMessages((previous) =>
        previous.some((message) => message.id === sent.id)
          ? previous
          : [...previous, sent as ChatMessage]
      );
    }

    setSending(false);
  }

  const filteredPlayers = players.filter((player) =>
    (player.username ?? "Chess player")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredConversations = conversations.filter((conversation) => {
    const otherId =
      conversation.player_one === userId
        ? conversation.player_two
        : conversation.player_one;

    const player = players.find((item) => item.id === otherId);

    return (player?.username ?? "Chess player")
      .toLowerCase()
      .includes(search.toLowerCase());
  });

  const currentPlayer = selectedPlayer;

  return (
    <main className="chat-page">
      <header className="chat-topbar">
        <button
          className="icon-button"
          onClick={() => router.push("/")}
          aria-label="Back to Chess Mate"
        >
          <ArrowLeft size={19} />
        </button>

        <div className="brand">
          <div className="brand-mark"><Swords size={21} /></div>
          <div>
            <strong>CHESS MATE</strong>
            <span>PLAYER MESSAGES</span>
          </div>
        </div>

        <div className="secure-label">
          <ShieldCheck size={15} /> Private chat
        </div>
      </header>

      <section className="chat-shell">
        <aside className={`chat-sidebar ${currentPlayer ? "mobile-hidden" : ""}`}>
          <div className="sidebar-heading">
            <div>
              <span className="eyebrow">YOUR COMMUNITY</span>
              <h1>Messages</h1>
            </div>
            <button
              className="icon-button"
              aria-label="Refresh"
              onClick={() => {
                if (userId) {
                  void loadConversations(userId);
                  void loadPlayers(userId);
                }
              }}
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <label className="search-box">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search players..."
            />
          </label>

          <div className="section-label">CONVERSATIONS</div>

          {loading ? (
            <div className="sidebar-empty">Loading conversations...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="sidebar-empty">
              <MessageCircle size={23} />
              <p>No conversations yet.</p>
              <span>Start a chat with a player below.</span>
            </div>
          ) : (
            <div className="conversation-list">
              {filteredConversations.map((conversation) => {
                const otherId =
                  conversation.player_one === userId
                    ? conversation.player_two
                    : conversation.player_one;
                const player = players.find((item) => item.id === otherId);

                return (
                  <button
                    key={conversation.id}
                    className={`conversation-item ${
                      conversationId === conversation.id ? "active" : ""
                    }`}
                    onClick={() => {
                      if (player) void openConversation(player);
                      else setError("Player profile not found in the profiles table.");
                    }}
                  >
                    <div className="avatar">
                      {player?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={player.avatar_url} alt="" />
                      ) : (
                        initials(player?.username ?? "CM")
                      )}
                    </div>
                    <div className="conversation-copy">
                      <strong>{player?.username ?? "Chess player"}</strong>
                      <span>Open conversation</span>
                    </div>
                    <MessageCircle size={15} />
                  </button>
                );
              })}
            </div>
          )}

          <div className="section-label player-label">
            <span>DISCOVER PLAYERS</span>
            <Plus size={15} />
          </div>

          <div className="player-list">
            {filteredPlayers.length === 0 ? (
              <div className="sidebar-empty">
                {search ? "No players match your search." : "No player profiles found."}
              </div>
            ) : (
              filteredPlayers.map((player) => (
                <button
                  key={player.id}
                  className={`player-item ${
                    currentPlayer?.id === player.id ? "active" : ""
                  }`}
                  onClick={() => void openConversation(player)}
                >
                  <div className="avatar">
                    {player.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={player.avatar_url} alt="" />
                    ) : (
                      initials(player.username ?? "CM")
                    )}
                  </div>
                  <div className="conversation-copy">
                    <strong>{player.username ?? "Chess player"}</strong>
                    <span>
                      {typeof player.rating === "number"
                        ? `${player.rating} rating`
                        : "Chess Mate player"}
                    </span>
                  </div>
                  <Plus size={16} />
                </button>
              ))
            )}
          </div>
        </aside>

        <section className={`chat-main ${!currentPlayer ? "mobile-hidden" : ""}`}>
          {!currentPlayer ? (
            <div className="welcome-panel">
              <div className="welcome-icon"><MessageCircle size={31} /></div>
              <span className="eyebrow">YOUR NEXT CONVERSATION</span>
              <h2>Make your move.</h2>
              <p>
                Connect with players, discuss your games, and challenge
                your next opponent.
              </p>
              <div className="welcome-features">
                <span><ShieldCheck size={15} /> Private conversations</span>
                <span><Swords size={15} /> Chess community</span>
              </div>
            </div>
          ) : (
            <>
              <header className="chat-header">
                <button
                  className="icon-button mobile-back"
                  onClick={() => setSelectedPlayer(null)}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="avatar large">
                  {currentPlayer.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentPlayer.avatar_url} alt="" />
                  ) : (
                    initials(currentPlayer.username ?? "CM")
                  )}
                </div>
                <div className="header-player">
                  <strong>{currentPlayer.username ?? "Chess player"}</strong>
                  <span>
                    {typeof currentPlayer.rating === "number"
                      ? `${currentPlayer.rating} rating`
                      : "Chess Mate player"}
                  </span>
                </div>
                <button
                  className="challenge-button"
                  onClick={() => router.push("/multiplayer")}
                >
                  <Swords size={16} /> Challenge
                </button>
              </header>

              <div className="messages-area">
                {messages.length === 0 ? (
                  <div className="first-message">
                    <div className="welcome-icon"><UserRound size={25} /></div>
                    <h3>Say hello to {currentPlayer.username ?? "your opponent"}</h3>
                    <p>Your private conversation starts here.</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const mine = message.sender_id === userId;

                    return (
                      <div
                        key={message.id}
                        className={`message-row ${mine ? "mine" : "theirs"}`}
                      >
                        <div className="message-bubble">
                          <p>{message.body}</p>
                          <time>
                            {new Date(message.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <form className="composer" onSubmit={sendMessage}>
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Write your message..."
                  maxLength={2000}
                  disabled={!conversationId || sending}
                  aria-label="Message"
                />
                <button
                  type="submit"
                  className="send-button"
                  disabled={!draft.trim() || !conversationId || sending}
                  aria-label="Send message"
                >
                  <Send size={17} />
                </button>
              </form>
              <div className="composer-hint">
                <ShieldCheck size={13} /> Keep your conversations respectful.
              </div>
            </>
          )}
        </section>
      </section>

      {error && (
        <div className="chat-toast error-toast" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      {notice && <div className="chat-toast">{notice}</div>}

      <style jsx>{`
        .chat-page {
          min-height: 100vh;
          color: #f1f4ee;
          background:
            radial-gradient(ellipse at 10% 0%, rgba(31, 100, 66, .2), transparent 40%),
            radial-gradient(ellipse at 100% 80%, rgba(177, 143, 65, .07), transparent 34%),
            #0a0f0c;
          font-family: inherit;
        }
        .chat-topbar {
          height: 76px;
          padding: 0 clamp(15px, 4vw, 58px);
          display: flex;
          align-items: center;
          gap: 16px;
          border-bottom: 1px solid rgba(255,255,255,.08);
          background: rgba(8,13,10,.8);
        }
        .icon-button {
          display: grid;
          place-items: center;
          width: 41px;
          height: 41px;
          flex-shrink: 0;
          color: #e6eee6;
          background: rgba(255,255,255,.035);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 12px;
          cursor: pointer;
        }
        .brand { display: flex; align-items: center; gap: 11px; }
        .brand-mark {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(213,182,109,.3);
          border-radius: 13px;
          background: rgba(213,182,109,.1);
          color: #d5b66d;
        }
        .brand strong, .brand span { display: block; letter-spacing: .12em; }
        .brand strong { font-size: 12px; }
        .brand span { margin-top: 5px; font-size: 9px; color: #bba66d; }
        .secure-label {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-left: auto;
          color: #a6b4a8;
          font-size: 12px;
        }
        .chat-shell {
          width: min(1320px, calc(100% - 36px));
          height: min(790px, calc(100vh - 112px));
          min-height: 570px;
          margin: 18px auto;
          display: grid;
          grid-template-columns: 330px minmax(0, 1fr);
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 20px;
          background: rgba(13,19,15,.94);
          box-shadow: 0 28px 90px rgba(0,0,0,.28);
        }
        .chat-sidebar {
          display: flex;
          flex-direction: column;
          min-height: 0;
          border-right: 1px solid rgba(255,255,255,.08);
          background: rgba(15,22,17,.94);
        }
        .sidebar-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 23px 20px 17px;
        }
        .eyebrow {
          color: #d5b66d;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .16em;
        }
        .sidebar-heading h1 {
          margin: 7px 0 0;
          font-size: 24px;
          letter-spacing: -.04em;
        }
        .search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 16px 19px;
          padding: 0 12px;
          min-height: 43px;
          color: #87968b;
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 11px;
          background: rgba(255,255,255,.035);
        }
        .search-box input {
          width: 100%;
          min-width: 0;
          outline: none;
          border: 0;
          color: #f0f4ee;
          background: transparent;
          font-size: 12px;
        }
        .section-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 19px 10px;
          color: #77867a;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .15em;
        }
        .conversation-list, .player-list {
          display: grid;
          gap: 3px;
          padding: 0 9px;
        }
        .conversation-list { max-height: 170px; overflow-y: auto; }
        .player-label { margin-top: 15px; }
        .player-list { min-height: 0; overflow-y: auto; padding-bottom: 14px; }
        .conversation-item, .player-item {
          display: flex;
          align-items: center;
          gap: 11px;
          width: 100%;
          min-width: 0;
          padding: 10px;
          text-align: left;
          color: #dfe7df;
          border: 1px solid transparent;
          border-radius: 12px;
          background: transparent;
          cursor: pointer;
          transition: background .18s, border-color .18s;
        }
        .conversation-item:hover, .player-item:hover, .conversation-item.active, .player-item.active {
          background: rgba(213,182,109,.07);
          border-color: rgba(213,182,109,.16);
        }
        .avatar {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 39px;
          height: 39px;
          overflow: hidden;
          border-radius: 13px;
          color: #e3ca86;
          font-size: 11px;
          font-weight: 800;
          background: linear-gradient(135deg,#263e2e,#17251b);
          border: 1px solid rgba(213,182,109,.16);
        }
        .avatar img { width: 100%; height: 100%; object-fit: cover; }
        .avatar.large { width: 43px; height: 43px; }
        .conversation-copy { display: grid; gap: 5px; flex: 1; min-width: 0; }
        .conversation-copy strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
        }
        .conversation-copy span { color: #829087; font-size: 10px; }
        .conversation-item > svg, .player-item > svg { flex-shrink: 0; color: #b9a46b; }
        .sidebar-empty {
          display: grid;
          justify-items: center;
          gap: 8px;
          padding: 22px 18px;
          color: #859288;
          text-align: center;
          font-size: 11px;
        }
        .sidebar-empty p { margin: 0; color: #c9d2ca; }
        .sidebar-empty span { line-height: 1.5; }
        .chat-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
        .welcome-panel {
          display: flex;
          flex: 1;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          text-align: center;
        }
        .welcome-icon {
          display: grid;
          place-items: center;
          width: 62px;
          height: 62px;
          margin-bottom: 21px;
          color: #d5b66d;
          border: 1px solid rgba(213,182,109,.22);
          border-radius: 19px;
          background: rgba(213,182,109,.08);
        }
        .welcome-panel h2 { margin: 12px 0; font-size: clamp(26px,4vw,39px); letter-spacing: -.045em; }
        .welcome-panel > p { max-width: 390px; color: #96a39a; font-size: 13px; line-height: 1.8; }
        .welcome-features { display: flex; flex-wrap: wrap; justify-content: center; gap: 18px; margin-top: 17px; }
        .welcome-features span { display: flex; align-items: center; gap: 7px; color: #9da99f; font-size: 11px; }
        .chat-header {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 78px;
          padding: 15px 22px;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }
        .header-player { display: grid; gap: 6px; min-width: 0; }
        .header-player strong { font-size: 13px; }
        .header-player span { color: #8c9a8f; font-size: 10px; }
        .challenge-button {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 38px;
          margin-left: auto;
          padding: 0 12px;
          color: #e4cb88;
          background: rgba(213,182,109,.08);
          border: 1px solid rgba(213,182,109,.24);
          border-radius: 10px;
          font-size: 11px;
          font-weight: 750;
          cursor: pointer;
        }
        .messages-area {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 14px;
          overflow-y: auto;
          padding: 24px clamp(15px, 4vw, 40px);
        }
        .first-message {
          display: grid;
          justify-items: center;
          align-content: center;
          flex: 1;
          text-align: center;
        }
        .first-message .welcome-icon { width: 50px; height: 50px; margin-bottom: 13px; }
        .first-message h3 { margin: 5px 0; font-size: 14px; }
        .first-message p { color: #89978d; font-size: 12px; }
        .message-row { display: flex; width: 100%; }
        .message-row.mine { justify-content: flex-end; }
        .message-row.theirs { justify-content: flex-start; }
        .message-bubble {
          max-width: min(78%, 480px);
          padding: 12px 15px 8px;
          overflow-wrap: anywhere;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 15px 15px 15px 5px;
          background: #19241c;
        }
        .mine .message-bubble {
          border-color: rgba(213,182,109,.2);
          border-radius: 15px 15px 5px 15px;
          background: linear-gradient(135deg,#264331,#1a3023);
        }
        .message-bubble p { margin: 0; color: #edf1e9; white-space: pre-wrap; font-size: 13px; line-height: 1.65; }
        .message-bubble time { display: block; margin-top: 6px; text-align: right; color: #89998d; font-size: 9px; }
        .composer {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 20px;
          padding: 8px 9px 8px 15px;
          min-height: 54px;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 14px;
          background: rgba(255,255,255,.035);
        }
        .composer input { flex: 1; min-width: 0; outline: none; border: 0; color: #edf1e9; background: transparent; font-size: 12px; }
        .composer input::placeholder { color: #718076; }
        .send-button {
          display: grid;
          place-items: center;
          width: 37px;
          height: 37px;
          color: #11170f;
          border: 0;
          border-radius: 11px;
          background: linear-gradient(135deg,#e6d18f,#b49a55);
          cursor: pointer;
        }
        .send-button:disabled { opacity: .4; cursor: not-allowed; }
        .composer-hint { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; color: #718075; font-size: 9px; }
        .mobile-back { display: none; }
        .chat-toast {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 20;
          max-width: min(450px,calc(100% - 40px));
          padding: 14px 16px;
          color: #d9e6d9;
          border: 1px solid rgba(213,182,109,.25);
          border-radius: 12px;
          background: #19241c;
          box-shadow: 0 12px 40px rgba(0,0,0,.4);
          font-size: 12px;
          overflow-wrap: anywhere;
        }
        .error-toast { color: #ffc1b9; }
        .chat-toast button { display: block; margin-top: 8px; color: #e3ca86; background: none; border: 0; cursor: pointer; }
        @media (max-width: 760px) {
          .chat-shell {
            width: calc(100% - 20px);
            height: calc(100dvh - 95px);
            min-height: 500px;
            margin: 10px auto;
            grid-template-columns: minmax(0,1fr);
          }
          .chat-sidebar, .chat-main { grid-column: 1; grid-row: 1; }
          .mobile-hidden { display: none !important; }
          .mobile-back { display: grid; }
          .chat-header { padding: 12px; gap: 9px; }
          .challenge-button { padding: 0 9px; font-size: 10px; }
          .chat-topbar { height: 68px; }
          .secure-label { font-size: 10px; }
          .chat-sidebar { border-right: 0; }
          .messages-area { padding: 18px 13px; }
          .composer { margin: 0 10px; }
        }
      `}</style>
    </main>
  );
}
