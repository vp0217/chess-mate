
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../utils/supabase/client";

type AuthMode = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signup");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    if (mode === "signup" && normalizedUsername.length < 3) {
      setError("Your username must contain at least 3 characters.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              username: normalizedUsername,
            },
          },
        });

        if (authError) throw authError;

        if (data.session) {
          router.push("/");
          router.refresh();
          return;
        }

        setMessage(
          "Account created! Check your email for a confirmation link before logging in."
        );
      } else {
        const { error: authError } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

        if (authError) throw authError;

        router.push("/");
        router.refresh();
        return;
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const gold = "#d5b56d";
  const muted = "#9ca99f";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 18px",
        background:
          "radial-gradient(ellipse at top, #183a30 0%, #101a17 42%, #090d0c 100%)",
        color: "#f4f1e8",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <section style={{ width: "100%", maxWidth: 440 }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            color: "#f4f1e8",
            textDecoration: "none",
            marginBottom: 28,
          }}
        >
          <span style={{ fontSize: 35, color: gold }}>♞</span>
          <span>
            <strong style={{ display: "block", letterSpacing: 2 }}>
              CHESS MATE
            </strong>
            <small style={{ color: muted, letterSpacing: 3 }}>
              PLAY SMART
            </small>
          </span>
        </Link>

        <div
          style={{
            padding: "32px 26px",
            border: "1px solid rgba(213,181,109,.25)",
            borderRadius: 20,
            background: "rgba(15,25,21,.88)",
            boxShadow: "0 24px 80px rgba(0,0,0,.3)",
          }}
        >
          <div style={{ marginBottom: 26 }}>
            <p
              style={{
                color: gold,
                fontSize: 11,
                letterSpacing: 3,
                fontWeight: 700,
              }}
            >
              YOUR NEXT MOVE STARTS HERE
            </p>
            <h1 style={{ fontSize: 29, margin: "12px 0 8px" }}>
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h1>
            <p style={{ color: muted, lineHeight: 1.6, fontSize: 14 }}>
              {mode === "signup"
                ? "Join Chess Mate and start building your chess profile."
                : "Log in to continue your chess journey."}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              padding: 5,
              background: "#0a100e",
              borderRadius: 11,
              marginBottom: 24,
            }}
          >
            {(["signup", "login"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setMode(item);
                  setError("");
                  setMessage("");
                }}
                style={{
                  border: "none",
                  borderRadius: 8,
                  padding: 12,
                  cursor: "pointer",
                  fontWeight: 700,
                  color: mode === item ? "#10140f" : muted,
                  background: mode === item ? gold : "transparent",
                }}
              >
                {item === "signup" ? "Create account" : "Log in"}
              </button>
            ))}
          </div>

          <form
            onSubmit={handleSubmit}
            style={{ display: "grid", gap: 16 }}
          >
            {mode === "signup" && (
              <label style={{ display: "grid", gap: 8, fontSize: 13 }}>
                Username
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Choose a chess username"
                  minLength={3}
                  maxLength={24}
                  autoComplete="username"
                  required
                  style={inputStyle}
                />
              </label>
            )}

            <label style={{ display: "grid", gap: 8, fontSize: 13 }}>
              Email address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 8, fontSize: 13 }}>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                required
                style={inputStyle}
              />
            </label>

            {error && (
              <p
                role="alert"
                style={{
                  color: "#ff9b9b",
                  background: "rgba(180,40,40,.12)",
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 13,
                  overflowWrap: "anywhere",
                }}
              >
                {error}
              </p>
            )}

            {message && (
              <p
                role="status"
                style={{
                  color: "#a8e5bd",
                  background: "rgba(40,150,80,.12)",
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                padding: 15,
                border: "none",
                borderRadius: 10,
                background: loading ? "#8d784d" : gold,
                color: "#11150f",
                fontWeight: 800,
                fontSize: 14,
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading
                ? "Please wait..."
                : mode === "signup"
                  ? "Create Chess Mate account"
                  : "Log in to Chess Mate"}
            </button>
          </form>

          <p
            style={{
              textAlign: "center",
              color: muted,
              fontSize: 12,
              lineHeight: 1.6,
              marginTop: 22,
            }}
          >
            By continuing, you agree to use Chess Mate respectfully and fairly.
          </p>
        </div>

        <p
          style={{
            textAlign: "center",
            color: muted,
            fontSize: 12,
            marginTop: 22,
          }}
        >
          Your game. Your strategy. Your next move.
        </p>
      </section>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "13px 14px",
  border: "1px solid #34453b",
  borderRadius: 9,
  background: "#0a100e",
  color: "#f4f1e8",
  outline: "none",
  fontSize: 14,
};
