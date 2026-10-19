
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { Chess, type Square } from "chess.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !publishableKey || !secretKey) {
      return NextResponse.json(
        { error: "Server configuration is incomplete." },
        { status: 500 }
      );
    }

    // Authenticate the player using their session cookies.
    const authClient = createServerClient(
      supabaseUrl,
      publishableKey,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Session refresh may not be writable in this context.
            }
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in first." },
        { status: 401 }
      );
    }

    // Server-only client. Never import this into browser components.
    const admin = createClient(supabaseUrl, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const body = await request.json().catch(() => null);

    const matchId =
      typeof body?.matchId === "string" ? body.matchId : "";
    const from =
      typeof body?.from === "string" ? body.from : "";
    const to =
      typeof body?.to === "string" ? body.to : "";
    const expectedFen =
      typeof body?.expectedFen === "string" ? body.expectedFen : "";
    const promotion =
      typeof body?.promotion === "string" ? body.promotion : undefined;

    if (
      !matchId ||
      !expectedFen ||
      !/^[a-h][1-8]$/.test(from) ||
      !/^[a-h][1-8]$/.test(to) ||
      (promotion && !["q", "r", "b", "n"].includes(promotion))
    ) {
      return NextResponse.json(
        { error: "Invalid move request." },
        { status: 400 }
      );
    }

    const { data: match, error: readError } = await admin
      .from("multiplayer_matches")
      .select(
        "id, white_player_id, black_player_id, status, fen, moves, current_turn"
      )
      .eq("id", matchId)
      .maybeSingle();

    if (readError || !match) {
      return NextResponse.json(
        { error: "Match not found." },
        { status: 404 }
      );
    }

    if (
      user.id !== match.white_player_id &&
      user.id !== match.black_player_id
    ) {
      return NextResponse.json(
        { error: "You are not a player in this match." },
        { status: 403 }
      );
    }

    if (match.status !== "active" || !match.black_player_id) {
      return NextResponse.json(
        { error: "This match is not active." },
        { status: 409 }
      );
    }

    if (match.fen !== expectedFen) {
      return NextResponse.json(
        {
          error: "The board has changed. Refresh and try again.",
          code: "STALE_POSITION",
        },
        { status: 409 }
      );
    }

    const game = new Chess(match.fen);

    if (game.turn() !== match.current_turn) {
      return NextResponse.json(
        { error: "Saved turn does not match the board." },
        { status: 409 }
      );
    }

    const playersTurn =
      (game.turn() === "w" && user.id === match.white_player_id) ||
      (game.turn() === "b" && user.id === match.black_player_id);

    if (!playersTurn) {
      return NextResponse.json(
        { error: "It is not your turn." },
        { status: 403 }
      );
    }

    let move;

    try {
      move = game.move({
        from: from as Square,
        to: to as Square,
        ...(promotion ? { promotion } : {}),
      });
    } catch {
      move = null;
    }

    if (!move) {
      return NextResponse.json(
        { error: "That is not a legal chess move." },
        { status: 400 }
      );
    }

    const gameOver = game.isGameOver();
    let result: string | null = null;
    let winnerId: string | null = null;

    if (game.isCheckmate()) {
      winnerId =
        move.color === "w"
          ? match.white_player_id
          : match.black_player_id;
      result = move.color === "w" ? "1-0" : "0-1";
    } else if (gameOver) {
      result = "1/2-1/2";
    }

    const oldMoves = Array.isArray(match.moves) ? match.moves : [];
    const newMoves = [
      ...oldMoves,
      {
        from: move.from,
        to: move.to,
        promotion: move.promotion ?? null,
        san: move.san,
        color: move.color,
        fen: game.fen(),
      },
    ];

    // Compare-and-update: only one request can save this position.
    const { data: savedMatch, error: saveError } = await admin
      .from("multiplayer_matches")
      .update({
        fen: game.fen(),
        moves: newMoves,
        current_turn: game.turn(),
        status: gameOver ? "completed" : "active",
        winner_id: winnerId,
        result,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchId)
      .eq("fen", expectedFen)
      .eq("current_turn", match.current_turn)
      .eq("status", "active")
      .select(
        "id, white_player_id, black_player_id, status, fen, moves, current_turn, winner_id, result, updated_at"
      )
      .maybeSingle();

    if (saveError) {
      console.error("Move save failed:", saveError.message);
      return NextResponse.json(
        { error: "Could not save the move." },
        { status: 500 }
      );
    }

    if (!savedMatch) {
      return NextResponse.json(
        {
          error: "Another move was saved first. Refresh the board.",
          code: "MOVE_CONFLICT",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      match: savedMatch,
      move: {
        from: move.from,
        to: move.to,
        san: move.san,
        color: move.color,
      },
    });
  } catch (error) {
    console.error("Move API error:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
