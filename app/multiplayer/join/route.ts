
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!url || !publishableKey || !secretKey) {
      return NextResponse.json(
        { error: "Server configuration is incomplete." },
        { status: 500 }
      );
    }

    const authClient = createServerClient(url, publishableKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(values) {
          try {
            values.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    });

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

    const body = await request.json().catch(() => null);
    const matchId =
      typeof body?.matchId === "string" ? body.matchId : "";

    if (!matchId) {
      return NextResponse.json(
        { error: "A match ID is required." },
        { status: 400 }
      );
    }

    const admin = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: match, error } = await admin
      .from("multiplayer_matches")
      .update({
        black_player_id: user.id,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchId)
      .eq("status", "waiting")
      .is("black_player_id", null)
      .neq("white_player_id", user.id)
      .select(
        "id, white_player_id, black_player_id, status, time_control, created_at"
      )
      .maybeSingle();

    if (error) {
      console.error("Join match failed:", error.message);
      return NextResponse.json(
        { error: "Could not join this match." },
        { status: 500 }
      );
    }

    if (!match) {
      return NextResponse.json(
        {
          error: "This match is no longer available. Refresh the lobby.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ match });
  } catch (error) {
    console.error("Join match API error:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
