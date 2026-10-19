
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
    const timeControl =
      typeof body?.timeControl === "string" ? body.timeControl : "";

    const controls: Record<string, number> = {
      "1+0": 1,
      "3+0": 3,
      "3+2": 3,
      "5+0": 5,
      "5+3": 5,
      "10+0": 10,
      "15+10": 15,
    };

    if (!Object.hasOwn(controls, timeControl)) {
      return NextResponse.json(
        { error: "Unsupported time control." },
        { status: 400 }
      );
    }

    const admin = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const minutes = controls[timeControl];

    const { data: match, error } = await admin
      .from("multiplayer_matches")
      .insert({
        white_player_id: user.id,
        black_player_id: null,
        status: "waiting",
        time_control: timeControl,
        white_seconds: minutes * 60,
        black_seconds: minutes * 60,
      })
      .select(
        "id, white_player_id, black_player_id, status, time_control, white_seconds, black_seconds, fen, moves, current_turn, created_at"
      )
      .single();

    if (error) {
      console.error("Create match failed:", error.message);
      return NextResponse.json(
        { error: "Could not create a match." },
        { status: 500 }
      );
    }

    return NextResponse.json({ match });
  } catch (error) {
    console.error("Create match API error:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
