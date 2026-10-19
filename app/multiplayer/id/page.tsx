
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Chess, type Square } from "chess.js";
import { createClient } from "../../utils/supabase/client";
import {
  ArrowLeft,
  Flag,
  RefreshCw,
  ShieldCheck,
  Swords,
} from "lucide-react";

type Match = {
  id: string;
  white_player_id: string;
  black_player_id: string | null;
  status: "waiting" | "active" | "completed" | "cancelled";
  fen: string;
  moves: unknown[];
  time_control: string;
  current_turn: "w" | "b";
  winner_id: string | null;
  result: string | null;
};

const PIECES: Record<string, string> = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};

export default function MultiplayerMatchPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const matchId = params.id;

  const [match, setMatch] = useState<Match | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [flipped, setFlipped] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const game = useMemo(() => {
    try {
      return new Chess(match?.fen);
    } catch {
      return new Chess();
    }
  }, [match?.fen]);

  const loadMatch = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      setNotice("Please sign in before entering a match.");
      setLoading(false);
      return;
    }

    setUserId(auth.user.id);

    const { data, error } = await supabase
      .from("multiplayer_matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();

    if (error) {
      setNotice(error.message);
    } else if (!data) {
      setNotice("This match could not be found or you do not have access.");
    } else {
      setMatch(data as Match);
      setNotice("");
    }

    setLoading(false);
  }, [matchId, supabase]);

  useEffect(() => {
    void loadMatch();
  }, [loadMatch]);

  useEffect(() => {
    const channel = supabase
      .channel(`chess-match-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "multiplayer_matches",
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setNotice("This match is no longer available.");
            return;
          }

          const updated = payload.new as Match;
          if (updated?.id) {
            setMatch(updated);
            setSelected(null);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, supabase]);

  const isWhite = Boolean(userId && match?.white_player_id === userId);
  const isBlack = Boolean(userId && match?.black_player_id === userId);
  const myColor = isWhite ? "w" : isBlack ? "b" : null;
  const isMyTurn = Boolean(myColor && game.turn() === myColor);
  const board = game.board();
  const files = flipped
    ? ["h", "g", "f", "e", "d", "c", "b", "a"]
    : ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = flipped
    ? [1, 2, 3, 4, 5, 6, 7, 8]
    : [8, 7, 6, 5, 4, 3, 2, 1];

  async function handleSquareClick(square: Square) {
    if (!match || !userId || !myColor) {
      setNotice("You are not a player in this match.");
      return;
    }

    if (match.status !== "active" || game.isGameOver()) {
      setNotice("This match is not currently accepting moves.");
      return;
    }

    if (!isMyTurn || saving) {
      setNotice("Wait for your turn.");
      return;
    }

    const piece = game.get(square);

    if (!selected) {
      if (piece && piece.color === myColor) {
        setSelected(square);
        setNotice("");
      }
      return;
    }

    if (piece && piece.color === myColor) {
      setSelected(square);
      return;
    }

    const candidate = new Chess(match.fen);

    try {
      candidate.move({ from: selected, to: square, promotion: "q" });
    } catch {
      setNotice("That is not a legal move.");
      setSelected(null);
      return;
    }

    setSaving(true);
    setNotice("Saving move…");

    const previousFen = match.fen;
    const history = candidate.history();

    const result = candidate.isCheckmate()
      ? (candidate.turn() === "w" ? "0-1" : "1-0")
      : candidate.isDraw()
        ? "1/2-1/2"
        : null;

    const updates = {
      fen: candidate.fen(),
      moves: history,
      current_turn: candidate.turn(),
      status: result ? "completed" : "active",
      result,
      winner_id: result
        ? candidate.isCheckmate()
          ? candidate.turn() === "w"
            ? match.black_player_id
            : match.white_player_id
          : null
        : null,
      updated_at: new Date().toISOString(),
    };

   
      const response = await fetch("/api/multiplayer/move", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId: match.id,
          from: selected,
          to: square,
          promotion: "q",
          expectedFen: previousFen,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setNotice(payload.error ?? "Could not save move.");

        if (
          response.status === 409 ||
          payload.code === "STALE_POSITION" ||
          payload.code === "MOVE_CONFLICT"
        ) {
          await loadMatch();
        }
      } else {
        setMatch(payload.match as Match);
        setNotice(
          payload.match.result
            ? `Game finished: ${payload.match.result}`
            : "Move saved."
        );
      }


    setSaving(false);
  }

  async function resignGame() {
    if (!match || !userId || !myColor || match.status !== "active") return;

    const opponentId = isWhite
      ? match.black_player_id
      : match.white_player_id;

    if (!opponentId) {
      setNotice("There is no opponent to resign against yet.");
      return;
    }

    if (!window.confirm("Are you sure you want to resign this game?")) return;

    setSaving(true);

    const { data, error } = await supabase
      .from("multiplayer_matches")
      .update({
        status: "completed",
        result: isWhite ? "0-1" : "1-0",
        winner_id: opponentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id)
      .eq("status", "active")
      .select("*")
      .maybeSingle();

    if (error) {
      setNotice(error.message);
    } else if (data) {
      setMatch(data as Match);
      setNotice("Game resigned.");
    } else {
      setNotice("The match has already changed. Refreshing…");
      await loadMatch();
    }

    setSaving(false);
  }

  if (loading) {
    return <main className="match-loading">Entering the arena…</main>;
  }

  if (!match) {
    return (
      <main className="match-loading">
        <p>{notice || "Match unavailable."}</p>
        <button onClick={() => router.push("/multiplayer")}>
          Back to lobby
        </button>
      </main>
    );
  }

  const isParticipant = Boolean(isWhite || isBlack);
  const opponentJoined = Boolean(match.black_player_id);
  const gameFinished = match.status === "completed" || game.isGameOver();

  return (
    <main className="live-match">
      <header className="match-header">
        <button className="match-icon-button" onClick={() => router.push("/multiplayer")}>
          <ArrowLeft size={18} />
        </button>

        <div className="match-brand">
          <div className="match-brand-icon"><Swords size={20} /></div>
          <div>
            <strong>CHESS MATE</strong>
            <span>LIVE ARENA</span>
          </div>
        </div>

        <button
          className="match-icon-button"
          onClick={() => void loadMatch()}
          aria-label="Refresh match"
        >
          <RefreshCw size={17} />
        </button>
      </header>

      <div className="match-layout">
        <section className="board-panel">
          <div className="match-title-row">
            <div>
              <span className="match-eyebrow">MULTIPLAYER MATCH</span>
              <h1>Make your move.</h1>
            </div>
            <span className={`match-status ${gameFinished ? "finished" : ""}`}>
              {gameFinished
                ? "Finished"
                : opponentJoined
                  ? "Live match"
                  : "Waiting for opponent"}
            </span>
          </div>

          <div className="player-strip">
            <div className="player-avatar"><Swords size={18} /></div>
            <div className="player-name">
              <strong>{isWhite ? "You · White" : "White player"}</strong>
              <span>{isWhite ? "Your pieces" : "Opponent"}</span>
            </div>
            <span className="player-side">WHITE</span>
          </div>

          <div className="board-frame">
            <div className="chess-board">
              {ranks.map((rank) =>
                files.map((file) => {
                  const square = `${file}${rank}` as Square;
                  const piece = board[8 - rank][file.charCodeAt(0) - 97];
                  const isLight = (file.charCodeAt(0) - 97 + rank) % 2 === 0;
                  const isSelected = selected === square;
                  const isLegal = selected
                    ? (() => {
                        try {
                          return game.moves({ square: selected, verbose: true })
                            .some((move) => move.to === square);
                        } catch {
                          return false;
                        }
                      })()
                    : false;

                  return (
                    <button
                      key={square}
                      className={[
                        "chess-square",
                        isLight ? "light-square" : "dark-square",
                        isSelected ? "selected-square" : "",
                        isLegal ? "legal-square" : "",
                      ].join(" ")}
                      onClick={() => void handleSquareClick(square)}
                      disabled={!isParticipant || saving || gameFinished}
                      aria-label={`${square}${piece ? ` ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}`}
                    >
                      {piece && (
                        <span
                          className={`piece-symbol ${piece.color === "w" ? "white-piece" : "black-piece"}`}
                        >
                          {PIECES[`${piece.color}${piece.type}`]}
                        </span>
                      )}
                      {file === (flipped ? "h" : "a") && (
                        <span className="rank-coordinate">{rank}</span>
                      )}
                      {rank === (flipped ? 1 : 8) && (
                        <span className="file-coordinate">{file}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="player-strip bottom-player">
            <div className="player-avatar"><Swords size={18} /></div>
            <div className="player-name">
              <strong>{isBlack ? "You · Black" : "Black player"}</strong>
              <span>{isBlack ? "Your pieces" : opponentJoined ? "Opponent" : "Waiting to join"}</span>
            </div>
            <span className="player-side">BLACK</span>
          </div>

          <div className="board-actions">
            <button
              className="match-secondary-button"
              onClick={() => setFlipped((value) => !value)}
            >
              Flip board
            </button>
            <button
              className="match-secondary-button"
              onClick={() => void loadMatch()}
            >
              Sync board
            </button>
            <button
              className="match-resign-button"
              disabled={!isParticipant || saving || gameFinished || !opponentJoined}
              onClick={() => void resignGame()}
            >
              <Flag size={15} /> Resign
            </button>
          </div>

          {notice && <p className="match-notice" role="status">{notice}</p>}
        </section>

        <aside className="match-sidebar">
          <section className="sidebar-card">
            <span className="match-eyebrow">MATCH DETAILS</span>
            <h2>{match.time_control}</h2>
            <p>Time control</p>
            <div className="sidebar-divider" />
            <div className="detail-row">
              <span>Match status</span>
              <strong>{match.status}</strong>
            </div>
            <div className="detail-row">
              <span>Your side</span>
              <strong>{isWhite ? "White" : isBlack ? "Black" : "Spectator"}</strong>
            </div>
            <div className="detail-row">
              <span>Moves played</span>
              <strong>{game.history().length}</strong>
            </div>
          </section>

          <section className="sidebar-card">
            <span className="match-eyebrow">MOVE HISTORY</span>
            <h2>Game notation</h2>
            {game.history().length === 0 ? (
              <p className="muted-copy">Your opening move starts the story.</p>
            ) : (
              <div className="move-history">
                {Array.from(
                  { length: Math.ceil(game.history().length / 2) },
                  (_, index) => (
                    <div className="move-row" key={index}>
                      <span>{index + 1}.</span>
                      <strong>{game.history()[index * 2]}</strong>
                      <strong>{game.history()[index * 2 + 1] ?? "…"}</strong>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          <div className="match-safety">
            <ShieldCheck size={18} />
            <div>
              <strong>Fair play first</strong>
              <p>This prototype uses demo matches. Real-money staking is disabled.</p>
            </div>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .live-match {
          min-height: 100vh;
          color: #f2f5ee;
          background:
            radial-gradient(ellipse at 0% 0%, rgba(24, 92, 61, .23), transparent 40%),
            #0b100e;
        }
        .match-loading {
          min-height: 100vh; display: grid; place-content: center; justify-items: center;
          gap: 18px; padding: 24px; background: #0b100e; color: #e8e9df;
        }
        .match-loading button {
          padding: 12px 18px; border: 1px solid #5d704f; border-radius: 10px;
          background: #1c3023; color: white; cursor: pointer;
        }
        .match-header {
          height: 76px; padding: 0 clamp(16px, 4vw, 54px);
          display: flex; align-items: center; gap: 18px;
          border-bottom: 1px solid rgba(255,255,255,.08);
          background: rgba(9,14,12,.8);
        }
        .match-icon-button {
          display: grid; place-items: center; width: 40px; height: 40px;
          border: 1px solid rgba(255,255,255,.12); border-radius: 12px;
          color: #f1f2e9; background: rgba(255,255,255,.035); cursor: pointer;
        }
        .match-brand { display: flex; align-items: center; gap: 11px; margin-right: auto; }
        .match-brand-icon {
          display: grid; place-items: center; width: 42px; height: 42px;
          color: #d8bb75; border: 1px solid rgba(202,168,94,.25);
          border-radius: 13px; background: rgba(202,168,94,.1);
        }
        .match-brand strong, .match-brand span { display: block; letter-spacing: .12em; }
        .match-brand strong { font-size: 12px; }
        .match-brand span { margin-top: 4px; color: #b5a16c; font-size: 9px; }
        .match-layout {
          width: min(1160px, calc(100% - 32px)); margin: 0 auto;
          padding: 35px 0 50px; display: grid;
          grid-template-columns: minmax(0, 1fr) 285px; gap: 28px; align-items: start;
        }
        .board-panel { min-width: 0; }
        .match-title-row { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 24px; }
        .match-eyebrow { color: #d3b56d; font-size: 9px; font-weight: 800; letter-spacing: .17em; }
        .match-title-row h1 { margin: 8px 0 0; font-size: clamp(26px, 4vw, 38px); letter-spacing: -.04em; }
        .match-status { padding: 8px 10px; border: 1px solid rgba(104,197,135,.25); border-radius: 99px; color: #8fdaa9; background: rgba(51,128,78,.12); font-size: 10px; white-space: nowrap; }
        .match-status.finished { color: #d8bb75; border-color: rgba(202,168,94,.3); background: rgba(202,168,94,.08); }
        .player-strip { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid rgba(255,255,255,.08); border-radius: 13px; background: rgba(255,255,255,.025); }
        .player-avatar { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 11px; color: #d8bb75; background: #202b23; }
        .player-name { display: grid; gap: 4px; min-width: 0; flex: 1; }
        .player-name strong { font-size: 12px; }
        .player-name span { color: #96a298; font-size: 10px; }
        .player-side { color: #b4bdaf; font-size: 9px; letter-spacing: .14em; }
        .board-frame { width: 100%; max-width: 680px; margin: 14px auto; padding: 7px; border: 1px solid rgba(202,168,94,.28); border-radius: 9px; background: #17231b; box-shadow: 0 24px 65px rgba(0,0,0,.3); }
        .chess-board { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); aspect-ratio: 1; overflow: hidden; border-radius: 4px; }
        .chess-square { position: relative; display: grid; place-items: center; min-width: 0; aspect-ratio: 1; padding: 0; border: 0; cursor: pointer; }
        .chess-square:disabled { cursor: default; }
        .light-square { background: #dce4c9; }
        .dark-square { background: #537d61; }
        .selected-square { box-shadow: inset 0 0 0 4px #e7c96f; }
        .legal-square::after { content: ""; position: absolute; width: 25%; aspect-ratio: 1; border-radius: 50%; background: rgba(15,38,22,.34); }
        .piece-symbol { position: relative; z-index: 1; font-family: "Apple Symbols", "Segoe UI Symbol", serif; font-size: clamp(25px, 5.3vw, 62px); line-height: 1; user-select: none; }
        .white-piece { color: #fffdf1; -webkit-text-stroke: 1px #37463b; text-shadow: 0 2px 2px rgba(0,0,0,.55); }
        .black-piece { color: #1a241c; text-shadow: 0 1px 0 rgba(255,255,255,.2); }
        .rank-coordinate, .file-coordinate { position: absolute; z-index: 2; font-size: clamp(8px, 1vw, 11px); font-weight: 800; }
        .rank-coordinate { top: 2px; left: 4px; }
        .file-coordinate { right: 4px; bottom: 2px; }
        .light-square .rank-coordinate, .light-square .file-coordinate { color: #537d61; }
        .dark-square .rank-coordinate, .dark-square .file-coordinate { color: #e0e8d4; }
        .bottom-player { margin-top: 14px; }
        .board-actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 15px; }
        .match-secondary-button, .match-resign-button {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          min-height: 39px; padding: 0 12px; border-radius: 10px; font-size: 11px;
          cursor: pointer;
        }
        .match-secondary-button { color: #d7dfd6; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.035); }
        .match-resign-button { margin-left: auto; color: #f0a6a0; border: 1px solid rgba(230,105,95,.25); background: rgba(150,45,40,.1); }
        .match-resign-button:disabled { opacity: .4; cursor: not-allowed; }
        .match-notice { padding: 12px 14px; margin-top: 13px; color: #e3cb88; background: rgba(202,168,94,.07); border: 1px solid rgba(202,168,94,.16); border-radius: 10px; font-size: 12px; overflow-wrap: anywhere; }
        .match-sidebar { display: grid; gap: 15px; }
        .sidebar-card { padding: 21px; border: 1px solid rgba(255,255,255,.08); border-radius: 17px; background: linear-gradient(145deg, rgba(25,39,29,.8), rgba(15,21,17,.9)); }
        .sidebar-card h2 { margin: 11px 0 5px; font-size: 22px; }
        .sidebar-card > p, .muted-copy { margin: 0; color: #97a397; font-size: 12px; }
        .sidebar-divider { height: 1px; margin: 18px 0; background: rgba(255,255,255,.08); }
        .detail-row { display: flex; justify-content: space-between; gap: 10px; margin-top: 14px; color: #98a59a; font-size: 11px; }
        .detail-row strong { color: #e2e7de; text-transform: capitalize; }
        .move-history { display: grid; gap: 3px; margin-top: 15px; }
        .move-row { display: grid; grid-template-columns: 28px 1fr 1fr; gap: 7px; padding: 8px; border-radius: 7px; background: rgba(255,255,255,.025); font-size: 12px; }
        .move-row span { color: #9ba79c; }
        .move-row strong { color: #e6e9e0; font-weight: 600; }
        .match-safety { display: flex; align-items: flex-start; gap: 11px; padding: 16px; border: 1px solid rgba(202,168,94,.16); border-radius: 14px; color: #d3b56d; background: rgba(202,168,94,.045); }
        .match-safety strong { color: #e6e5d9; font-size: 11px; }
        .match-safety p { margin: 6px 0 0; color: #9ba69a; font-size: 10px; line-height: 1.6; }
        @media (max-width: 850px) {
          .match-layout { grid-template-columns: minmax(0, 1fr); max-width: 680px; }
          .match-sidebar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .match-safety { grid-column: 1 / -1; }
        }
        @media (max-width: 520px) {
          .match-layout { width: calc(100% - 20px); padding-top: 24px; }
          .match-header { height: 66px; padding: 0 12px; }
          .match-title-row { align-items: flex-start; flex-direction: column; }
          .match-sidebar { grid-template-columns: 1fr; }
          .piece-symbol { font-size: clamp(23px, 10vw, 42px); }
          .board-frame { padding: 4px; }
          .selected-square { box-shadow: inset 0 0 0 2px #e7c96f; }
          .match-status { align-self: flex-start; }
        }
      `}</style>
    </main>
  );
}
