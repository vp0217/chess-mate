
"use client";

import { useEffect, useState } from "react";
import { createClient } from "../utils/supabase/client";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Zap,
  Clock3,
  Swords,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

type Match = {
  id: string;
  white_player_id: string;
  black_player_id: string | null;
  status: "waiting" | "active" | "completed" | "cancelled";
  time_control: string;
  created_at: string;
};

export default function MultiplayerPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [timeControl, setTimeControl] = useState("10+0");

  const supabase = createClient();

  async function loadMatches() {
    setError("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError("Please sign in before playing multiplayer.");
      setLoading(false);
      return;
    }

    setUserId(authData.user.id);

    const { data, error: queryError } = await supabase
      .from("multiplayer_matches")
      .select(
        "id, white_player_id, black_player_id, status, time_control, created_at"
      )
      .eq("status", "waiting")
      .is("black_player_id", null)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
    } else {
      setMatches(data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("multiplayer-match-lobby")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "multiplayer_matches",
        },
        () => {
          void loadMatches();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createMatch() {
    if (!userId || busy) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/multiplayer/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ timeControl }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not create a match.");
      } else if (payload.match?.id) {
        router.push(`/multiplayer/${payload.match.id}`);
        return;
      } else {
        setError("The server did not return a match.");
      }
    } catch {
      setError("Could not connect to the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function joinMatch(match: Match) {
    if (!userId || busy) return;

    if (match.white_player_id === userId) {
      setError("This is your own waiting game.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/multiplayer/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ matchId: match.id }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not join this match.");
        await loadMatches();
        return;
      }

      if (payload.match?.id) {
        router.push(`/multiplayer/${payload.match.id}`);
        return;
      }

      setError("The server did not return the joined match.");
      await loadMatches();
    } catch {
      setError("Could not connect to the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="multiplayer-page">
      <header className="multiplayer-topbar">
        <button
          className="mp-back"
          onClick={() => router.push("/")}
          aria-label="Back to Chess Mate"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="mp-brand">
          <div className="mp-brand-mark">
            <Swords size={20} />
          </div>
          <div>
            <strong>CHESS VICTOR</strong>
            <span>LIVE ARENA</span>
          </div>
        </div>

        <div className="mp-secure">
          <ShieldCheck size={15} />
          Demo matches
        </div>
      </header>

      <section className="mp-content">
        <div className="mp-heading">
          <span className="mp-eyebrow">THE NEXT MOVE IS YOURS</span>
          <h1>Find your <span>opponent.</span></h1>
          <p>
            Create a game for another player or enter the arena
            and join an open challenge.
          </p>
        </div>

        <section className="mp-create-card">
          <div className="mp-card-icon">
            <Zap size={23} />
          </div>

          <div className="mp-create-copy">
            <span className="mp-eyebrow">HOST A MATCH</span>
            <h2>Set the challenge.</h2>
            <p>Your game waits in the lobby until an opponent joins.</p>

            <label htmlFor="mp-time-control">Time control</label>
            <select
              id="mp-time-control"
              value={timeControl}
              onChange={(event) => setTimeControl(event.target.value)}
              disabled={busy}
            >
              <option value="1+0">Bullet · 1 minute</option>
              <option value="3+0">Blitz · 3 minutes</option>
              <option value="5+0">Blitz · 5 minutes</option>
              <option value="10+0">Rapid · 10 minutes</option>
              <option value="15+10">Rapid · 15 minutes + 10 sec</option>
            </select>

            <button
              className="mp-primary"
              onClick={() => void createMatch()}
              disabled={busy || !userId}
            >
              {busy ? "Please wait…" : "Create a match"}
              <Swords size={17} />
            </button>
          </div>
        </section>

        <section className="mp-lobby">
          <div className="mp-lobby-heading">
            <div>
              <span className="mp-eyebrow">OPEN CHALLENGES</span>
              <h2>Players waiting</h2>
            </div>

            <button
              className="mp-refresh"
              onClick={() => {
                setLoading(true);
                void loadMatches();
              }}
              disabled={loading}
              aria-label="Refresh matches"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {loading ? (
            <div className="mp-empty">Loading the arena…</div>
          ) : error ? (
            <div className="mp-error">
              <p>{error}</p>
              <button
                className="mp-secondary"
                onClick={() => {
                  setLoading(true);
                  void loadMatches();
                }}
              >
                Try again
              </button>
            </div>
          ) : matches.filter((match) => match.white_player_id !== userId).length === 0 ? (
            <div className="mp-empty">
              <div className="mp-empty-icon">
                <Users size={24} />
              </div>
              <h3>No open challenges yet</h3>
              <p>
                Create a match, then open Chess Mate in a second signed-in
                account to join it.
              </p>
            </div>
          ) : (
            <div className="mp-match-list">
              {matches
                .filter((match) => match.white_player_id !== userId)
                .map((match) => (
                  <article className="mp-match" key={match.id}>
                    <div className="mp-opponent-avatar">
                      <Swords size={20} />
                    </div>

                    <div className="mp-match-details">
                      <strong>Open challenge</strong>
                      <span>
                        <Clock3 size={13} />
                        {match.time_control}
                        <span className="mp-dot">·</span>
                        Waiting for opponent
                      </span>
                    </div>

                    <button
                      className="mp-join"
                      disabled={busy}
                      onClick={() => void joinMatch(match)}
                    >
                      Join <ArrowLeft size={15} />
                    </button>
                  </article>
                ))}
            </div>
          )}
        </section>

        <p className="mp-disclaimer">
          <ShieldCheck size={14} />
          Practice multiplayer only. No real-money staking or entry fees.
        </p>
      </section>

      <style jsx>{`
        .multiplayer-page {
          min-height: 100vh;
          color: #f3f5ef;
          background:
            radial-gradient(ellipse at 12% 0%, rgba(25, 95, 66, .24), transparent 42%),
            radial-gradient(ellipse at 100% 55%, rgba(145, 112, 44, .08), transparent 35%),
            #0b100e;
          font-family: inherit;
        }
        .multiplayer-topbar {
          min-height: 78px;
          padding: 0 clamp(18px, 5vw, 72px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 1px solid rgba(255,255,255,.08);
          background: rgba(9,14,12,.78);
        }
        .mp-back, .mp-refresh {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 13px;
          color: #e9eee8;
          background: rgba(255,255,255,.04);
          cursor: pointer;
        }
        .mp-brand { display: flex; align-items: center; gap: 12px; margin-right: auto; }
        .mp-brand-mark, .mp-card-icon, .mp-empty-icon {
          display: grid;
          place-items: center;
          color: #d8bb75;
          background: rgba(202,168,94,.1);
          border: 1px solid rgba(202,168,94,.25);
          border-radius: 14px;
        }
        .mp-brand-mark { width: 43px; height: 43px; }
        .mp-brand strong, .mp-brand span { display: block; letter-spacing: .12em; }
        .mp-brand strong { font-size: 12px; }
        .mp-brand span { margin-top: 5px; color: #a99a72; font-size: 9px; }
        .mp-secure { display: flex; align-items: center; gap: 7px; color: #a7b7ab; font-size: 12px; }
        .mp-content { width: min(940px, calc(100% - 36px)); margin: 0 auto; padding: 64px 0 44px; }
        .mp-eyebrow { color: #d5b66d; font-size: 10px; font-weight: 800; letter-spacing: .18em; }
        .mp-heading { margin-bottom: 35px; }
        .mp-heading h1 { margin: 14px 0 12px; font-size: clamp(34px, 6vw, 58px); line-height: 1.05; letter-spacing: -.045em; }
        .mp-heading h1 span { color: #d5b66d; }
        .mp-heading p, .mp-create-copy p { max-width: 560px; color: #9ba79f; line-height: 1.7; font-size: 14px; }
        .mp-create-card {
          display: grid;
          grid-template-columns: 54px 1fr;
          gap: 20px;
          padding: clamp(22px, 4vw, 36px);
          border: 1px solid rgba(205,178,113,.2);
          border-radius: 22px;
          background: linear-gradient(135deg, rgba(26,49,37,.92), rgba(16,23,19,.97));
          box-shadow: 0 24px 70px rgba(0,0,0,.22);
        }
        .mp-card-icon { width: 52px; height: 52px; }
        .mp-create-copy h2, .mp-lobby-heading h2 { margin: 9px 0; font-size: 22px; letter-spacing: -.025em; }
        .mp-create-copy p { margin: 0 0 22px; }
        .mp-create-copy label { display: block; margin-bottom: 8px; color: #c4cec6; font-size: 12px; }
        .mp-create-copy select {
          display: block; width: 100%; max-width: 360px; min-height: 46px; padding: 0 12px;
          color: #f4f4ee; background: #111b15; border: 1px solid rgba(255,255,255,.14);
          border-radius: 10px; outline: none;
        }
        .mp-primary, .mp-join, .mp-secondary {
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          min-height: 45px; padding: 0 17px; border-radius: 11px; font-weight: 750; cursor: pointer;
        }
        .mp-primary { margin-top: 16px; color: #10150f; background: linear-gradient(135deg,#e5cf8c,#b9a05a); border: 0; }
        .mp-primary:disabled, .mp-join:disabled { opacity: .55; cursor: not-allowed; }
        .mp-lobby { margin-top: 42px; }
        .mp-lobby-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 17px; }
        .mp-lobby-heading h2 { margin-bottom: 0; }
        .mp-empty {
          padding: 36px 20px; text-align: center; border: 1px solid rgba(255,255,255,.08);
          border-radius: 18px; background: rgba(255,255,255,.025);
        }
        .mp-empty-icon { width: 48px; height: 48px; margin: 0 auto 14px; }
        .mp-empty h3 { margin: 0 0 9px; font-size: 16px; }
        .mp-empty p { max-width: 450px; margin: auto; color: #9ba79f; font-size: 13px; line-height: 1.7; }
        .mp-error { padding: 20px; border: 1px solid rgba(240,110,110,.25); border-radius: 14px; color: #ffb9b9; overflow-wrap: anywhere; }
        .mp-secondary { color: #f3f5ef; background: #202a23; border: 1px solid rgba(255,255,255,.12); }
        .mp-match-list { display: grid; gap: 10px; }
        .mp-match {
          display: flex; align-items: center; gap: 15px; padding: 17px;
          border: 1px solid rgba(255,255,255,.08); border-radius: 15px;
          background: rgba(255,255,255,.025);
        }
        .mp-opponent-avatar { display: grid; place-items: center; width: 43px; height: 43px; flex: 0 0 auto; border-radius: 13px; color: #d8bb75; background: #202b23; }
        .mp-match-details { display: grid; gap: 7px; min-width: 0; flex: 1; }
        .mp-match-details strong { font-size: 13px; }
        .mp-match-details span { display: flex; align-items: center; gap: 6px; color: #a5b0a7; font-size: 11px; }
        .mp-dot { color: #d5b66d; }
        .mp-join { color: #e5cf8c; background: rgba(202,168,94,.09); border: 1px solid rgba(202,168,94,.28); }
        .mp-join svg { transform: rotate(180deg); }
        .mp-disclaimer { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 28px; color: #7e8b81; font-size: 11px; text-align: center; }
        @media (max-width: 560px) {
          .multiplayer-topbar { min-height: 68px; padding: 0 15px; }
          .mp-secure { font-size: 10px; }
          .mp-content { padding-top: 42px; }
          .mp-create-card { grid-template-columns: 1fr; gap: 15px; }
          .mp-match { flex-wrap: wrap; }
          .mp-join { margin-left: auto; }
        }
      `}</style>
    </main>
  );
}
