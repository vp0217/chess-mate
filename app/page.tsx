
'use client';

import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { Chess, type Square, type PieceSymbol } from 'chess.js';
import { createClient } from "./utils/supabase/client";

import {
  Activity, ArrowUpRight, Bell, ChevronDown, ChevronRight,
  CircleHelp, Crown, Gem, History, Home, Menu, MessageSquare,
  MoreHorizontal, Plus, Search, Settings2, ShieldCheck, Swords,
  Trophy, Users, Wallet, X, RotateCcw, Flag, Clock3
} from 'lucide-react';

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const PIECES: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
};

const PIECE_NAMES: Record<string, string> = {
  wK: 'White king', wQ: 'White queen', wR: 'White rook',
  wB: 'White bishop', wN: 'White knight', wP: 'White pawn',
  bK: 'Black king', bQ: 'Black queen', bR: 'Black rook',
  bB: 'Black bishop', bN: 'Black knight', bP: 'Black pawn'
};

type Screen =
  | 'Play' | 'Tournaments' | 'Leaderboard'
  | 'Friends' | 'Wallet' | 'Profile' | 'Community';

type GameMode = 'rapid' | 'blitz' | 'bullet';

type PromotionRequest = {
  from: Square;
  to: Square;
  color: 'w' | 'b';
};

const TIME_LIMITS: Record<GameMode, number> = {
  rapid: 600,
  blitz: 180,
  bullet: 60
};

const NAVIGATION = [
  { id: 'Play' as Screen, label: 'Play', Icon: Home },
  { id: 'Tournaments' as Screen, label: 'Tournaments', Icon: Trophy },
  { id: 'Leaderboard' as Screen, label: 'Leaderboard', Icon: Activity },
  { id: 'Friends' as Screen, label: 'Friends', Icon: Users },
  { id: 'Wallet' as Screen, label: 'Wallet', Icon: Wallet },
  { id: 'Community' as Screen, label: 'Community', Icon: MessageSquare }
];
function getTimeGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>('Play');
  const [fen, setFen] = useState(INITIAL_FEN);
  const [selected, setSelected] = useState<Square | null>(null);
  const [legal, setLegal] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<[Square, Square] | null>(null);
  const [orientation, setOrientation] = useState<'w' | 'b'>('w');
  const [gameMode, setGameMode] = useState<GameMode>('rapid');
  const [whiteSeconds, setWhiteSeconds] = useState(600);
  const [blackSeconds, setBlackSeconds] = useState(600);
  const [running, setRunning] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [promotion, setPromotion] = useState<PromotionRequest | null>(null);
  const recordedResultRef = useRef<string | null>(null);
  const [modal, setModal] = useState('');
  const [joinedTournaments, setJoinedTournaments] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [coins, setCoins] = useState(2500);
  const [moveList, setMoveList] = useState<string[]>([]);
  const [mobileNav, setMobileNav] = useState(false);
  const [resigned, setResigned] = useState(false);
  const [drawOffered, setDrawOffered] = useState(false);
  const [playerName, setPlayerName] = useState("Player");

useEffect(() => {
  let active = true;

  const loadTournamentRegistrations = async () => {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Tournament auth error:", authError.message);
      return;
    }

    if (!user) {
      if (active) setJoinedTournaments([]);
      return;
    }

    const { data, error } = await supabase
      .from("tournament_registrations")
      .select("tournament_id")
      .eq("user_id", user.id);

    if (error) {
      console.error("Could not load tournament registrations:", error.message);
      return;
    }

    if (active) {
      setJoinedTournaments(
        (data ?? []).map((registration) => registration.tournament_id)
      );
    }
  };

  void loadTournamentRegistrations();

  return () => {
    active = false;
  };
}, []);

  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);

const recordPracticeResult = useCallback(
  async (result: "win" | "loss" | "draw", movesCount: number, termination: string) => {
    try {
      const supabase = createClient();

      const { error } = await supabase.rpc("record_practice_result", {
        p_result: result,
        p_moves_count: movesCount,
        p_termination: termination,
      });

      if (error) {
        console.error("Could not record practice result:", error.message);
      }
    } catch (error) {
      console.error("Failed to record practice result:", error);
    }
  },
  []
);
useEffect(() => {
  let active = true;

  async function loadPlayerName() {
    const supabase = createClient();

    const { data, error } = await supabase.auth.getUser();

    if (!active || error || !data.user) {
      return;
    }

    const user = data.user;

    const metadataName =
      user.user_metadata?.username ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.display_name;

    const emailName = user.email
      ? user.email.split("@")[0]
      : "";

    const name = metadataName || emailName || "Player";

    setPlayerName(String(name).trim() || "Player");
  }

  void loadPlayerName();

  return () => {
    active = false;
  };
}, []);
  const gameOver = chess.isGameOver() || resigned;
  const whiteToMove = chess.turn() === 'w';
  const inCheck = chess.isCheck();

  const notify = useCallback((message: string) => {
    setNotice(message);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(id);
  }, [notice]);

  // Run only the clock belonging to the side whose turn it is.
  useEffect(() => {
    if (!running || gameOver) return;

    const side = chess.turn();

    const id = window.setInterval(() => {
      if (side === 'w') {
        setWhiteSeconds(current => {
          if (current <= 1) {
            setRunning(false);
            setNotice('White ran out of time.');
            return 0;
          }
          return current - 1;
        });
      } else {
        setBlackSeconds(current => {
          if (current <= 1) {
            setRunning(false);
            setNotice('Black ran out of time.');
            return 0;
          }
          return current - 1;
        });
      }
    }, 1000);

    return () => window.clearInterval(id);
  }, [running, fen, chess, gameOver]);

  const squares = useMemo(() => {
    const files = orientation === 'w'
      ? 'abcdefgh'.split('')
      : 'hgfedcba'.split('');

    const ranks = orientation === 'w'
      ? '87654321'.split('')
      : '12345678'.split('');

    return ranks.flatMap(rank =>
      files.map(file => `${file}${rank}` as Square)
    );
  }, [orientation]);

  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60)
      .toString().padStart(2, '0')}`;

  const resultText = useMemo(() => {
    if (resigned) return 'Game resigned';
    if (whiteSeconds === 0) return 'Black wins on time';
    if (blackSeconds === 0) return 'White wins on time';
    if (chess.isCheckmate()) {
      return chess.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate';
    }
    if (chess.isStalemate()) return 'Draw by stalemate';
    if (chess.isThreefoldRepetition()) return 'Draw by repetition';
    if (chess.isInsufficientMaterial()) return 'Draw by insufficient material';
    if (chess.isDraw()) return 'Game drawn';
    return '';
  }, [chess, resigned, whiteSeconds, blackSeconds]);

  // Commit a legal move to the chess engine and record its SAN notation.
  const commitMove = useCallback((
    from: Square,
    to: Square,
    promotionPiece?: PieceSymbol
  ) => {
    try {
      const move = chess.move({
        from,
        to,
        ...(promotionPiece ? { promotion: promotionPiece } : {})
      });

      if (!move) {
        notify('That move is not legal.');
        return;
      }

      setFen(chess.fen());
      setLastMove([move.from as Square, move.to as Square]);
      setMoveList(previous => [
        ...previous,
        `${move.color === 'w' ? `${Math.floor(previous.length / 2) + 1}. ` : ''}${move.san}`
      ]);
      setSelected(null);
      setLegal([]);
      setPromotion(null);
      setGameStarted(true);
      setDrawOffered(false);

      if (chess.isGameOver()) {
  setRunning(false);

  if (recordedResultRef.current === null) {
    recordedResultRef.current = chess.fen();

    const result = chess.isDraw()
      ? "draw"
      : chess.turn() === "w"
        ? "loss"
        : "win";

    void recordPracticeResult(
      result,
      chess.history().length,
      chess.isCheckmate() ? "checkmate" : "completed"
    );
  }
} else {
  setRunning(true);
}
    } catch {
      setSelected(null);
      setLegal([]);
      setPromotion(null);
      notify('Unable to complete that move. Please try again.');
    }
  }, [chess, notify]);

  const squareClick = (square: Square) => {
    if (gameOver || promotion) return;

    const piece = chess.get(square);

    if (selected && legal.includes(square)) {
      const movingPiece = chess.get(selected);
      const isPromotion =
        movingPiece?.type === 'p' &&
        (square.endsWith('8') || square.endsWith('1'));

      if (isPromotion && movingPiece) {
        setPromotion({
          from: selected,
          to: square,
          color: movingPiece.color
        });
        return;
      }

      commitMove(selected, square);
      return;
    }

    if (piece && piece.color === chess.turn()) {
      setSelected(square);
      setLegal(
        chess.moves({ square, verbose: true }).map(move => move.to as Square)
      );
    } else {
      setSelected(null);
      setLegal([]);
    }
  };

  const resetGame = () => {
    const startingTime = TIME_LIMITS[gameMode];

    setFen(INITIAL_FEN);
    setSelected(null);
    setLegal([]);
    setLastMove(null);
    setMoveList([]);
    setWhiteSeconds(startingTime);
    setBlackSeconds(startingTime);
    setRunning(false);
    setGameStarted(false);
    setPromotion(null);
    setResigned(false);
    setDrawOffered(false);
    setModal('');
    notify('New game ready.');
  };

  const selectMode = (mode: GameMode) => {
    setGameMode(mode);
    const time = TIME_LIMITS[mode];
    setWhiteSeconds(time);
    setBlackSeconds(time);
    setRunning(false);
    setGameStarted(false);
    setFen(INITIAL_FEN);
    setMoveList([]);
    setSelected(null);
    setLegal([]);
    setLastMove(null);
    setResigned(false);
    setPromotion(null);
    setDrawOffered(false);
  };

  const undoMove = () => {
    if (moveList.length === 0 || gameOver) {
      notify('There are no moves to undo.');
      return;
    }

    const replay = new Chess();
    const history = chess.history();

    try {
      history.pop();
      history.forEach(move => replay.move(move));

      setFen(replay.fen());
      setMoveList(previous => previous.slice(0, -1));
      setLastMove(null);
      setSelected(null);
      setLegal([]);
      setRunning(false);
      notify('Last move undone.');
    } catch {
      notify('Could not undo the last move.');
    }
  };

  const navTo = (destination: Screen) => {
    setScreen(destination);
    setMobileNav(false);
  };

  return (
    <main className="app-shell app-enter">
      <aside className={`sidebar ${mobileNav ? 'show' : ''}`}>
        <button className="brand" onClick={() => navTo('Play')}>
          <span className="brand-mark">♞</span>
          <span>
            CHESS <span className="gold">MATE</span>
            <small>PLAY SMART. STAKE. WIN.</small>
          </span>
        </button>

        <div className="side-label">WORKSPACE</div>

        <nav>
          {NAVIGATION.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`nav-item ${screen === id ? 'active' : ''}`}
              onClick={() => navTo(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === 'Tournaments' && <span className="nav-live">LIVE</span>}
            </button>
          ))}
        </nav>

        <div className="side-label side-label-spaced">YOUR CLUB</div>

        <button className="nav-item" onClick={() => setModal('Challenge a friend')}>
          <Swords size={18} />
          <span>Challenge a friend</span>
          <Plus size={16} className="push" />
        </button>

        <button className="nav-item" onClick={() => setModal('Private room')}>
          <ShieldCheck size={18} />
          <span>Private rooms</span>
        </button>

        <div className="sidebar-bottom">
          <div className="club-card">
            <div className="club-icon"><Crown size={20} /></div>
            <b>The Grandmaster Club</b>
            <p>Your next great game is one move away.</p>
            <button onClick={() => notify('Club membership preview coming soon.')}>
              Explore club <ChevronRight size={14} />
            </button>
          </div>

          <button className="profile-mini" onClick={() => navTo('Profile')}>
            <div className="avatar">JA</div>
            <span>
              <b>Joseph Amos</b>
              <small>Candidate Master · 1,842</small>
            </span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu icon-btn"
            onClick={() => setMobileNav(value => !value)}
            aria-label="Toggle navigation"
          >
            <Menu size={20} />
          </button>

          <div className="breadcrumb">
            Clubhouse <ChevronRight size={14} /> <b>{screen}</b>
          </div>

          <div className="top-actions">
            <div className="demo-pill"><span /> DEMO MODE</div>

            <button className="coin-pill" onClick={() => navTo('Wallet')}>
              <span className="coin">◈</span>
              {coins.toLocaleString()}
              <ChevronDown size={14} />
            </button>

            <button
              className="icon-btn"
              aria-label="Search"
              onClick={() => setModal('Find a player')}
            >
              <Search size={18} />
            </button>

            <button
              className="icon-btn bell"
              aria-label="Notifications"
              onClick={() => notify('You’re all caught up.')}
            >
              <Bell size={18} />
              <i />
            </button>

            <div className="avatar top-avatar">JA</div>
          </div>
        </header>

        {screen === 'Play' ? (
          <>
            <div className="welcome-row">
              <div>
                <div className="eyebrow">
                  <span className="eyebrow-line" /> CHESS MATE CLUB
                </div>
                <h1>
                {getTimeGreeting()}, {playerName}
                </h1>
                <p className="muted">The board is set. Make your next move count.</p>
              </div>
              <button
                className="outline-btn"
                onClick={() => setModal('How to play CHESS MATE')}
              >
                <CircleHelp size={16} /> How to play
              </button>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-top"><span>RAPID RATING</span><Trophy size={17} /></div>
                <div className="stat-number">1,842 <span className="up">↗ 24</span></div>
                <div className="stat-bottom">Top 8% of active players</div>
                <div className="sparkline">
                  <svg viewBox="0 0 200 35" preserveAspectRatio="none">
                    <path
                      d="M0 29 L20 24 L38 27 L55 15 L75 20 L92 10 L110 17 L129 7 L145 12 L165 4 L182 10 L200 2"
                      fill="none" stroke="#c7a45b" strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-top"><span>GAMES PLAYED</span><History size={17} /></div>
                <div className="stat-number">128</div>
                <div className="stat-bottom">72 wins · 18 draws · 38 losses</div>
                <div className="win-bar"><i /><i /><i /></div>
              </div>

              <div className="stat-card">
                <div className="stat-top"><span>WIN RATE</span><Activity size={17} /></div>
                <div className="stat-number">56.3<span className="unit">%</span></div>
                <div className="stat-bottom">Across your last 128 games</div>
                <div className="rate-track"><span /></div>
              </div>

              <div className="stat-card wallet-stat">
                <div className="stat-top"><span>DEMO BALANCE</span><Gem size={17} /></div>
                <div className="stat-number">
                  {coins.toLocaleString()} <span className="unit">VC</span>
                </div>
                <div className="stat-bottom">Virtual coins · No real value</div>
                <button className="text-link" onClick={() => navTo('Wallet')}>
                  Manage wallet <ArrowUpRight size={14} />
                </button>
              </div>
            </div>

            <div className="content-grid">
              <div className="left-column">
                <section className="panel play-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow">YOUR NEXT MOVE</div>
                      <h2>Find your game</h2>
                    </div>
                    <span className="online"><i /> Practice arena</span>
                  </div>

                  <div className="mode-tabs">
                    {(['rapid', 'blitz', 'bullet'] as const).map(mode => (
                      <button
                        key={mode}
                        className={gameMode === mode ? 'chosen' : ''}
                        onClick={() => selectMode(mode)}
                      >
                        <span>{TIME_LIMITS[mode] / 60}</span>
                        <span>
                          {mode.toUpperCase()}
                          <small>
                            {mode === 'rapid' ? '10 min + 0 sec'
                              : mode === 'blitz' ? '3 min + 0 sec'
                              : '1 min + 0 sec'}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="match-options">
                    <button
                      className="primary-btn"
                      onClick={() => {
                        resetGame();
                        setRunning(true);
                        setGameStarted(true);
                        notify('Practice game started. Play both sides locally.');
                      }}
                    >
                      <Swords size={17} /> Quick match <ChevronRight size={17} />
                    </button>

                    <button
                      className="secondary-btn"
                      onClick={() => setModal('Challenge a friend')}
                    >
                      <Users size={17} /> Challenge a friend <ChevronRight size={16} />
                    </button>

                    <button
                      className="secondary-btn"
                      onClick={() => setModal('Private room')}
                    >
                      <Plus size={17} /> Create private room <ChevronRight size={16} />
                    </button>
                  </div>

                  <div className="safe-note">
                    <ShieldCheck size={15} />
                    <span>
                      Practice with virtual coins. Real-money play is currently disabled.
                    </span>
                  </div>
                </section>

                <section className="panel recent-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow">PICK UP WHERE YOU LEFT OFF</div>
                      <h2>Current game</h2>
                    </div>
                    <button className="quiet-link" onClick={undoMove}>
                      <RotateCcw size={14} /> Undo move
                    </button>
                  </div>

                  <div className="recent-row">
                    <div className="mini-board">
                      <span>♜</span><span>♞</span><span>♝</span>
                      <span>♚</span><span>♟</span><span>♟</span>
                      <span>♙</span><span>♘</span><span>♙</span>
                    </div>
                    <div className="recent-info">
                      <b>{gameStarted ? 'Local practice game' : 'Ready to play'}</b>
                      <small>
                        {gameMode.toUpperCase()} · {moveList.length} half-moves recorded
                      </small>
                    </div>
                    <span className={`result ${gameOver ? 'loss' : 'win'}`}>
                      {gameOver ? 'ENDED' : 'DEMO'}
                    </span>
                  </div>

                  <div className="move-history">
                    <span>MOVE HISTORY</span>
                    <div>
                      {moveList.length
                        ? moveList.join(' ')
                        : 'Moves will appear here as you play.'}
                    </div>
                  </div>
                </section>
              </div>

              <div className="right-column">
                <section className="panel board-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow">PRACTICE ARENA</div>
                      <h2>Chessboard</h2>

                <div className="move-history">
                  <span>MOVE HISTORY</span>

                  {moveList.length > 0 ? (
                    <div className="move-history-list">
                      {moveList.slice(-8).map((move, index) => {
                        const actualIndex = moveList.length - Math.min(8, moveList.length) + index;

                        return (
                          <div
                            className={`move-history-item ${
                              actualIndex === moveList.length - 1 ? 'latest' : ''
                            }`}
                            key={`${move}-${actualIndex}`}
                          >
                            <span className="move-history-number">
                              {move.match(/^\d+\./)?.[0] || '·'}
                            </span>
                            <span>{move.replace(/^\d+\.\s*/, '')}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="move-history-empty">
                      Your moves will appear here.
                    </div>
                  )}
                </div>

                    </div>
                    <button
                      className="icon-btn"
                      onClick={() => setOrientation(value => value === 'w' ? 'b' : 'w')}
                      title="Flip board"
                      aria-label="Flip board"
                    >
                      <Settings2 size={17} />
                    </button>
                  </div>

                  <div className="opponent-row">
                    <div className="op-avatar">♞</div>
                    <div>
                      <b>Black pieces</b>
                      <small>{chess.turn() === 'b' ? 'Black to move' : 'Waiting for turn'}</small>
                    </div>
                    <span className={`clock ${chess.turn() === 'b' && running ? 'active-clock' : ''}`}>
                      {formatTime(blackSeconds)}
                    </span>
                  </div>

                  <div className="chessboard" role="grid" aria-label="Interactive chessboard">
                    {squares.map((square, index) => {
                      const piece = chess.get(square);
                      const light =
                        (Number(square[1]) + square.charCodeAt(0)) % 2 !== 0;
                      const isLastMove = lastMove?.includes(square) ?? false;
                      const isKingInCheck =
                        inCheck &&
                        piece?.type === 'k' &&
                        piece.color === chess.turn();

                      const squareClass = [
                        'square',
                        light ? 'light' : 'dark',
                        selected === square ? 'selected' : '',
                        legal.includes(square) ? 'legal' : '',
                        isLastMove ? 'last-move' : '',
                        isKingInCheck ? 'in-check' : ''
                      ].filter(Boolean).join(' ');

                      return (
                        <button
                          key={square}
                          type="button"
                          role="gridcell"
                          aria-label={`${square}${piece ? `, ${PIECE_NAMES[piece.color + piece.type.toUpperCase()]}` : ''}`}
                          aria-selected={selected === square}
                          className={squareClass}
                          onClick={() => squareClick(square)}
                        >
                          {piece && (
                            <span
                              className={`piece chess-piece ${piece.color === 'w' ? 'white-piece' : 'black-piece'}`}
                            >
                              {PIECES[piece.color + piece.type.toUpperCase()]}
                            </span>
                          )}

                          {index % 8 === 0 && (
                            <span className="rank-label">{square[1]}</span>
                          )}

                          {Math.floor(index / 8) === 7 && (
                            <span className="file-label">{square[0]}</span>
                          )}

                          {legal.includes(square) && !piece && (
                            <span className="legal-dot" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                {/* Captured pieces */}
                {(() => {
                  const captures = chess.history({ verbose: true }).filter(
                    move => Boolean(move.captured)
                  );

                  const whiteCaptures = captures.filter(move => move.color === 'w');
                  const blackCaptures = captures.filter(move => move.color === 'b');

                  return (
                    <div className="captured-panel">
                      <div className="captured-row">
                        <span className="captured-label">WHITE CAPTURES</span>
                        <div className="captured-pieces">
                          {whiteCaptures.length ? (
                            whiteCaptures.map((move, index) => (
                              <span
                                className="captured-piece"
                                key={`white-${move.to}-${index}`}
                                title={`Captured ${move.captured}`}
                              >
                                {PIECES[`b${move.captured!.toUpperCase()}`]}
                              </span>
                            ))
                          ) : (
                            <span className="captured-empty">No captures yet</span>
                          )}
                        </div>
                      </div>

                      <div className="captured-row">
                        <span className="captured-label">BLACK CAPTURES</span>
                        <div className="captured-pieces">
                          {blackCaptures.length ? (
                            blackCaptures.map((move, index) => (
                              <span
                                className="captured-piece"
                                key={`black-${move.to}-${index}`}
                                title={`Captured ${move.captured}`}
                              >
                                {PIECES[`w${move.captured!.toUpperCase()}`]}
                              </span>
                            ))
                          ) : (
                            <span className="captured-empty">No captures yet</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}


                  <div className="opponent-row bottom-player">
                    <div className="avatar">JA</div>
                    <div>
                      <b>Joseph Amos <span className="you-label">YOU</span></b>
                      <small>
                        {chess.turn() === 'w' ? 'White to move' : 'Waiting for white'}
                        {inCheck && chess.turn() === 'w' ? ' · Check!' : ''}
                      </small>
                    </div>
                    <span className={`clock ${chess.turn() === 'w' && running ? 'active-clock' : ''}`}>
                      {formatTime(whiteSeconds)}
                    </span>
                  </div>

                  
                {gameOver && (
                  <div className="game-end" role="status" aria-live="polite">
                    <div className="game-end-icon">
                      {chess.isCheckmate()
                        ? '♛'
                        : chess.isDraw()
                          ? '🤝'
                          : resigned
                            ? '⚑'
                            : '♔'}
                    </div>

                    <span className="game-end-kicker">GAME COMPLETE</span>

                    <strong>{resultText || 'Game over'}</strong>

                    <p>
                      {chess.isCheckmate()
                        ? 'A decisive finish. Well played.'
                        : chess.isDraw()
                          ? 'A hard-fought game. Neither side takes the win.'
                          : resigned
                            ? 'This practice game has been resigned.'
                            : whiteSeconds === 0 || blackSeconds === 0
                              ? 'Time has run out. The clock decides the result.'
                              : 'Thanks for playing. Ready for another challenge?'}
                    </p>

                    <button className="primary-btn" onClick={resetGame}>
                      <RotateCcw size={15} />
                      Play again
                    </button>
                  </div>
                )}


                  <div className="board-actions">
                    <button
                      className="secondary-btn"
                      disabled={gameOver}
                      onClick={() => {
                        setRunning(false);
                        setModal('Resign game?');
                      }}
                    >
                      <Flag size={14} /> Resign
                    </button>

                    <button
                      className="secondary-btn"
                      disabled={gameOver}
                      onClick={() => {
                        setDrawOffered(true);
                        notify('Draw offer recorded in this local demo.');
                      }}
                    >
                      Offer draw
                    </button>

                    <button className="primary-btn small-primary" onClick={resetGame}>
                      New game
                    </button>
                  </div>

                  {drawOffered && !gameOver && (
                    <div className="safe-note">
                      Draw offer recorded. Online opponent responses are not connected.
                    </div>
                  )}

                 
                <div className="move-history">
                  <span>MOVE HISTORY</span>

                  {moveList.length > 0 ? (
                    <div className="move-history-list">
                      {moveList.map((move, index) => (
                        <div
                          className={`move-history-item ${
                            index === moveList.length - 1 ? 'latest' : ''
                          }`}
                          key={`${move}-${index}`}
                        >
                          <span className="move-history-number">
                            {move.match(/^\d+\./)?.[0] || '·'}
                          </span>
                          <span>{move.replace(/^\d+\.\s*/, '')}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="move-history-empty">
                      Moves will appear here as you play.
                    </div>
                  )}
                </div>

                </section>

                <section className="panel tournament-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow">THE WEEKLY CLASSIC</div>
                      <h2>Emerald Open</h2>
                    </div>
                    <span className="live-tag"><i /> UPCOMING</span>
                  </div>

                  <div className="tourney-banner">
                    <div className="trophy-art">
                      <Trophy size={42} />
                      <span>♟</span>
                    </div>
                    <div>
                      <span className="tourney-kicker">WEEKLY TOURNAMENT</span>
                      <b>Emerald Open #24</b>
                      <small>Demo tournament preview</small>
                    </div>
                  </div>

                  <div className="tourney-meta">
                    <span><Users size={15} /> Practice players</span>
                    <span><Gem size={15} /> Demo VC only</span>
                  </div>

                  <button
                    className="secondary-btn full-btn"
                    onClick={() => navTo('Tournaments')}
                  >
                    View tournaments <ChevronRight size={16} />
                  </button>
                </section>
              </div>
            </div>
          </>
        ) : (
          <section className="subpage">
            <div className="eyebrow">
              <span className="eyebrow-line" /> CHESS MATE CLUB
            </div>

            <h1>
              {screen === 'Wallet' ? 'Your wallet'
                : screen === 'Profile' ? 'Player profile'
                : screen === 'Community' ? 'Community & messages'
                : screen === 'Friends' ? 'Your chess circle'
                : screen === 'Leaderboard' ? 'The leaderboard'
                : 'Tournaments'}
              <span className="gold">.</span>
            </h1>

            <p className="muted">
              {screen === 'Wallet'
                ? 'Manage your demo coins. No real-money transactions are enabled.'
                : screen === 'Profile'
                ? 'Your progress, your history, your next milestone.'
                : screen === 'Community'
                ? 'Connect with players and share chess moments.'
                : screen === 'Friends'
                ? 'Find your people and make the next game personal.'
                : screen === 'Leaderboard'
                ? 'Explore player rankings and standings.'
                : 'Compete, improve your strategy, and climb the standings.'}
            </p>

            {screen === 'Wallet' ? (
              <div className="wallet-feature panel">
                <div className="wallet-big">
                  <Gem size={26} />
                  <span>DEMO VIRTUAL BALANCE</span>
                  <strong>{coins.toLocaleString()} <small>VC</small></strong>
                  <p>Virtual coins have no cash value and cannot be withdrawn.</p>
                </div>

                <div className="wallet-buttons">
                  <button
                    className="primary-btn"
                    onClick={() => {
                      setCoins(value => value + 500);
                      notify('500 demo coins added.');
                    }}
                  >
                    <Plus size={16} /> Claim 500 demo coins
                  </button>
                  <button
                    className="secondary-btn"
                    onClick={() => setModal('Wallet activity')}
                  >
                    View activity <ChevronRight size={16} />
                  </button>
                </div>

                <div className="disabled-real">
                  <ShieldCheck size={20} />
                  <div>
                    <b>Real-money mode is disabled</b>
                    <p>
                      Deposits, wagers, escrow and payouts are not available in this prototype.
                    </p>
                  </div>
                  <span>NOT ACTIVE</span>
                </div>
              </div>
            ) : screen === 'Profile' ? (
              <div className="panel profile-feature">
                <div className="avatar profile-avatar">JA</div>
                <h2>Joseph Amos</h2>
                <p>Candidate Master · Demo profile</p>
                <div className="profile-stats">
                  <div><b>1,842</b><small>Rapid rating</small></div>
                  <div><b>{moveList.length}</b><small>Current game moves</small></div>
                  <div><b>{formatTime(whiteSeconds)}</b><small>White clock</small></div>
                </div>
                <button className="secondary-btn" onClick={() => setModal('Edit profile')}>
                  Edit profile <ChevronRight size={16} />
                </button>
              </div>
            ) : screen === 'Community' ? (
              <div className="panel empty-feature">
                <div className="empty-icon"><MessageSquare /></div>
                <h2>Your chess community</h2>
                <p>
                  The community interface is a preview. Posting, messaging and online
                  accounts require a connected backend.
                </p>
                <button className="primary-btn" onClick={() => setModal('Create a post')}>
                  Share a chess moment <Plus size={16} />
                </button>
              </div>
            
          ) : screen === 'Tournaments' ? (
              <div className="tournament-hub">

    <div className="tournament-hero">
      <div>
        <span className="tournament-eyebrow">CHESS MATE COMPETITIVE</span>
        <h2>Compete for glory.</h2>
        <p>Enter the arena, challenge your skills, and climb the rankings.</p>
      </div>
      <div className="tournament-hero-icon">
        <Trophy size={48} />
      </div>
    </div>

    <div className="tournament-stats">
      <div className="tournament-stat">
        <span>Available events</span>
        <strong>03</strong>
      </div>
      <div className="tournament-stat">
        <span>Entry fee</span>
        <strong>Free</strong>
      </div>
      <div className="tournament-stat">
        <span>Prize mode</span>
        <strong>Practice</strong>
      </div>
    </div>

    <div className="tournament-section-heading">
      <div>
        <h3>Featured tournaments</h3>
        <p>Choose an event to explore.</p>
      </div>
      <span className="tournament-live-label">
        <span className="tournament-live-dot" />
        DEMO EVENTS
      </span>
    </div>

    
<div className="tournament-list">
  {[
    {
      id: 'rapid',
      name: 'Emerald Rapid Arena',
      format: 'Rapid',
      time: '10 + 0',
      players: '16-player target',
      description: 'A thoughtful battle of strategy and precision.',
      accent: 'emerald',
      schedule: 'Open practice event',
      icon: '♜',
    },
    {
      id: 'blitz',
      name: 'Golden Blitz Cup',
      format: 'Blitz',
      time: '5 + 0',
      players: '16-player target',
      description: 'Fast decisions. Sharp tactics. No wasted moves.',
      accent: 'gold',
      schedule: 'Open practice event',
      icon: '♞',
    },
    {
      id: 'bullet',
      name: 'Lightning Bullet Rush',
      format: 'Bullet',
      time: '1 + 0',
      players: '16-player target',
      description: 'Test your speed in a lightning-fast arena.',
      accent: 'violet',
      schedule: 'Open practice event',
      icon: '♛',
    },
  ].map((event) => {
    const joined = joinedTournaments.includes(event.id);

    return (
      <article
        className={`tournament-card tournament-card-${event.accent}`}
        key={event.id}
      >
        <div className="tournament-card-icon">
          <span>{event.icon}</span>
          <Trophy size={19} />
        </div>

        <div className="tournament-card-info">
          <div className="tournament-card-topline">
            <span className="tournament-format-label">
              {event.format.toUpperCase()} ARENA
            </span>

            <span className={`tournament-status ${joined ? 'joined' : ''}`}>
              <i />
              {joined ? 'REGISTERED' : 'OPEN'}
            </span>
          </div>

          <h4>{event.name}</h4>
          <p>{event.description}</p>

          <div className="tournament-tags">
            <span><Clock3 size={13} /> {event.time}</span>
            <span><Users size={13} /> {event.players}</span>
            <span><Gem size={13} /> Free entry</span>
          </div>

          <div className="tournament-card-footer">
            <span>{event.schedule}</span>
            <span className="tournament-demo-label">DEMO EVENT</span>
          </div>
        </div>

        <button
          className={`primary-btn tournament-join-btn ${joined ? 'tournament-joined-btn' : ''}`}
          onClick={() => setModal(`Tournament registration: ${event.id}`)}
        >
          {joined ? 'View registration' : 'Explore event'}
          <ChevronRight size={16} />
        </button>
      </article>
    );
  })}
</div>


    <p className="tournament-disclaimer">
      Demo events only. Tournament registration, live pairings, and results
      will be connected to the tournament backend in a later step.
    </p>
  </div>
) : (
  <div className="panel empty-feature">
    <div className="empty-icon">
      {screen === 'Leaderboard' ? <Crown /> : <Users />}
    </div>
    <h2>
      {screen === 'Leaderboard'
        ? 'Season standings'
        : 'Invite a worthy opponent'}
    </h2>
    <p>
      {screen === 'Leaderboard'
        ? 'Live rankings will be connected when player accounts are available.'
        : 'Challenge friends when online multiplayer is connected.'}
    </p>
    <button
      className="primary-btn"
      onClick={() =>
        setModal(
          screen === 'Friends'
            ? 'Challenge a friend'
            : 'Leaderboard filters'
        )
      }
    >
      {screen === 'Friends' ? 'Invite a friend' : 'Explore rankings'}
      <ChevronRight size={16} />
    </button>
    </div>
    
            )}
        
          </section>
        )}

        <footer className="footer">
          <span>© 2026 CHESS MATE CLUB</span>
          <span><ShieldCheck size={13} /> FAIR PLAY, ALWAYS</span>
          <span>BUILT FOR THE NEXT MOVE <span className="gold">♞</span></span>
        </footer>
      </section>

      {notice && (
        <div className="toast" role="status">
          <span className="toast-check">✓</span>
          {notice}
          <button aria-label="Dismiss notification" onClick={() => setNotice('')}>
            <X size={14} />
          </button>
        </div>
      )}

      {promotion && (
        <div className="modal-backdrop">
          <div className="modal promotion-modal">
            <div className="eyebrow">SPECIAL MOVE</div>
            <h2>Promote your pawn</h2>
            <p>Choose the piece your pawn should become.</p>

            <div className="promotion-options">
              {([
                ['q', 'Queen'],
                ['r', 'Rook'],
                ['b', 'Bishop'],
                ['n', 'Knight']
              ] as [PieceSymbol, string][]).map(([piece, label]) => (
                <button
                  key={piece}
                  className="promotion-piece"
                  onClick={() => commitMove(promotion.from, promotion.to, piece)}
                  aria-label={`Promote to ${label}`}
                >
                  <span className={`piece chess-piece ${promotion.color === 'w' ? 'white-piece' : 'black-piece'}`}>
                    {PIECES[promotion.color + piece.toUpperCase()]}
                  </span>
                  <small>{label}</small>
                </button>
              ))}
            </div>

            <button
              className="secondary-btn full-btn"
              onClick={() => setPromotion(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal('')}>
          <div className="modal" onClick={event => event.stopPropagation()}>
            <button
              className="modal-close"
              aria-label="Close dialog"
              onClick={() => setModal('')}
            >
              <X size={18} />
            </button>

            <div className="modal-icon"><Crown size={22} /></div>
            <div className="eyebrow">CHESS MATE CLUB</div>
            <h2>{modal}</h2>

            {modal === 'Resign game?' ? (
              <>
                <p>Are you sure you want to resign this practice game?</p>
                <div className="modal-actions">
                  <button className="secondary-btn" onClick={() => setModal('')}>
                    Keep playing
                  </button>
                  <button
                    className="primary-btn"
                    onClick={() => {
                      setResigned(true);
                      setRunning(false);
                      setModal('');
                      notify('Practice game resigned.');
                    }}
                  >
                    Confirm resign
                  </button>
                </div>
              </>

) : modal.startsWith('Tournament registration: ') ? (
  (() => {
    const tournamentId = modal.replace('Tournament registration: ', '');
    const tournaments = [
      {
        id: 'rapid',
        name: 'Emerald Rapid Arena',
        format: 'Rapid',
        time: '10 + 0',
        description: 'A strategic contest for players who value precision and planning.',
      },
      {
        id: 'blitz',
        name: 'Golden Blitz Cup',
        format: 'Blitz',
        time: '5 + 0',
        description: 'A fast-paced competition where every second matters.',
      },
      {
        id: 'bullet',
        name: 'Lightning Bullet Rush',
        format: 'Bullet',
        time: '1 + 0',
        description: 'A lightning-fast challenge built for quick decisions.',
      },
    ];

    const event = tournaments.find(item => item.id === tournamentId);
    const joined = joinedTournaments.includes(tournamentId);

    if (!event) return <p>Tournament not found.</p>;

    return (
      <>
        <div className="eyebrow">CHESS MATE COMPETITIVE</div>
        <h3>{event.name}</h3>
        <p>{event.description}</p>

        <div className="tournament-tags">
          <span>{event.format}</span>
          <span>{event.time}</span>
          <span>Free entry</span>
          <span>Demo event</span>
        </div>

        <p>
          {joined
            ? 'You have joined this demo tournament. Registration is stored for this page session only.'
            : 'Join this demo event to mark yourself as a participant.'}
        </p>

        <div className="modal-actions">
          <button
            className="secondary-btn"
            onClick={() => setModal('')}
          >
            Close
          </button>

          
<button
  className="primary-btn"
  disabled={false}
  onClick={async () => {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      notify("Please sign in before joining a tournament.");
      return;
    }

    if (joined) {
      const { error } = await supabase
        .from("tournament_registrations")
        .delete()
        .eq("tournament_id", tournamentId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Tournament withdrawal failed:", error.message);
        notify("Could not leave the tournament. Please try again.");
        return;
      }

      setJoinedTournaments(current =>
        current.filter(id => id !== tournamentId)
      );
      notify(`You left ${event.name}.`);
    } else {
      const { error } = await supabase
        .from("tournament_registrations")
        .insert({
          tournament_id: tournamentId,
          user_id: user.id,
        });

      if (error) {
        if (error.code === "23505") {
          notify("You are already registered for this tournament.");
        } else {
          console.error("Tournament registration failed:", error.message);
          notify("Could not join the tournament. Please try again.");
        }
        return;
      }

      setJoinedTournaments(current =>
        current.includes(tournamentId)
          ? current
          : [...current, tournamentId]
      );
      notify(`Successfully joined ${event.name}.`);
    }

    setModal("");
  }}
>
  {joined ? "Leave tournament" : "Join tournament"}
  <ChevronRight size={16} />
</button>

        </div>
      </>
    );
  })()


            ) : modal === 'How to play CHESS MATE' ? (
              <>
                <p>
                  Select a piece to see its legal moves, then choose a highlighted
                  square. The chess engine validates moves and supports check,
                  checkmate, castling, en passant, and pawn promotion.
                </p>
                <button className="primary-btn full-btn" onClick={() => setModal('')}>
                  Got it
                </button>
              </>
            ) : (
              <>
                <p>
                  {modal === 'Private room'
                    ? 'Private rooms are a preview until online multiplayer is connected.'
                    : modal === 'Challenge a friend'
                    ? 'Friend challenges will become available when accounts and multiplayer are connected.'
                    : modal === 'Find a player'
                    ? 'Player search needs a connected player directory.'
                    : modal === 'Wallet activity'
                    ? 'This prototype does not yet store a persistent transaction history.'
                    : modal === 'Edit profile'
                    ? 'Profile editing will be connected to account settings.'
                    : 'This feature is part of the Chess Mate prototype and is not yet connected to a backend.'}
                </p>

                <div className="modal-actions">
                  <button className="secondary-btn" onClick={() => setModal('')}>
                    Close
                  </button>
                  <button
                    className="primary-btn"
                    onClick={() => {
                      setModal('');
                      notify('Preview closed.');
                    }}
                  >
                    Continue <ChevronRight size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
