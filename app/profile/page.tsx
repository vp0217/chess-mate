
"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trophy,
  Swords,
  Target,
  UserRound,
  Settings,
  LogOut,
  ShieldCheck,
  Pencil,
  Check,
  X,
  LoaderCircle,
  Crown,
  CalendarDays,
  Camera,
  ImagePlus
} from "lucide-react";
import { createClient } from "../utils/supabase/client";

type PlayerProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  created_at: string;
};

export default function PlayerProfilePage() {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        router.replace("/auth");
        return;
      }

      setEmail(userData.user.email ?? "");

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select(
          "id, username, avatar_url, rating, wins, losses, draws, created_at"
        )
        .eq("id", userData.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!data) {
        setError(
          "Your player profile hasn't been created yet. Please sign out and sign back in, then refresh this page."
        );
        return;
      }

      const player = data as PlayerProfile;
      setProfile(player);
      setUsername(player.username);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your player profile."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) return;

    const cleanUsername = username.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      setError(
        "Username must be 3–24 characters and contain only letters, numbers, or underscores."
      );
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const supabase = createClient();

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({ username: cleanUsername })
        .eq("id", profile.id)
        .select(
          "id, username, avatar_url, rating, wins, losses, draws, created_at"
        )
        .single();

      if (updateError) {
        if (updateError.code === "23505") {
          throw new Error("That username is already taken. Choose another.");
        }
        throw updateError;
      }

      setProfile(data as PlayerProfile);
      setUsername(data.username);
      setEditing(false);
      setNotice("Your profile has been updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update your profile."
      );
    } finally {
      setSaving(false);
    }
  }
async function handleAvatarUpload(
  event: ChangeEvent<HTMLInputElement>
) {
  const file = event.target.files?.[0];
  event.target.value = "";

  if (!file || !profile) return;

  if (!file.type.startsWith("image/")) {
    setError("Please select an image file.");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    setError("Your image must be 5 MB or smaller.");
    return;
  }

  setUploadingAvatar(true);
  setError("");
  setNotice("");

  try {
    const supabase = createClient();

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      throw new Error("Please sign in again before uploading an avatar.");
    }

    const userId = authData.user.id;
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${userId}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const avatarUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", userId);

    if (updateError) {
      await supabase.storage.from("avatars").remove([filePath]);
      throw updateError;
    }

    setProfile((current) =>
      current ? { ...current, avatar_url: avatarUrl } : current
    );

    setNotice("Your profile photo has been updated successfully.");
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to upload your profile photo."
    );
  } finally {
    setUploadingAvatar(false);
  }
}
  async function handleSignOut() {
    setSigningOut(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) throw signOutError;

      router.replace("/auth");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to sign out."
      );
      setSigningOut(false);
    }
  }

  const gamesPlayed = profile
    ? profile.wins + profile.losses + profile.draws
    : 0;

  const winRate =
    profile && gamesPlayed > 0
      ? Math.round((profile.wins / gamesPlayed) * 100)
      : 0;

  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en", {
        month: "long",
        year: "numeric",
      })
    : "New player";

  const gold = "#D7BE83";
  const ivory = "#F0F1E8";
  const muted = "#9EAEA5";
  const panel = "#172820";
  const border = "rgba(142,181,155,.17)";

  const buttonStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "11px 15px",
    borderRadius: 10,
    border: `1px solid ${border}`,
    background: "#1D3329",
    color: ivory,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
  } as const;

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0B1410",
          color: gold,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <LoaderCircle
            size={34}
            style={{ margin: "0 auto 12px", animation: "spin 1s linear infinite" }}
          />
          <p style={{ color: muted }}>Loading your player profile...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "26px 18px 50px",
        background:
          "radial-gradient(ellipse at 50% 0%, #203F32 0%, #111F18 40%, #0A120E 100%)",
        color: ivory,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1020, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 30,
          }}
        >
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              color: ivory,
              textDecoration: "none",
            }}
          >
            <span style={{ color: gold, fontSize: 32 }}>♞</span>
            <span>
              <strong style={{ display: "block", letterSpacing: 2 }}>
                CHESS VICTOR
              </strong>
              <small
                style={{
                  color: muted,
                  letterSpacing: 3,
                  fontSize: 9,
                }}
              >
                PLAYER&apos;S CLUB
              </small>
            </span>
          </Link>

          <Link href="/" style={buttonStyle}>
            <ArrowLeft size={15} />
            Back to chess
          </Link>
        </header>

        <section
          style={{
            padding: "clamp(22px, 4vw, 38px)",
            borderRadius: 22,
            border: `1px solid ${border}`,
            background:
              "linear-gradient(125deg, rgba(34,67,51,.92), rgba(17,31,24,.98) 65%)",
            boxShadow: "0 24px 70px rgba(0,0,0,.18)",
            marginBottom: 22,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                flexWrap: "wrap",
              }}
            >
             <div
  style={{
    position: "relative",
    width: 100,
    height: 100,
    flexShrink: 0,
  }}
>
  <div
    style={{
      width: "100%",
      height: "100%",
      borderRadius: 25,
      border: `1px solid rgba(215,190,131,.55)`,
      background: "linear-gradient(145deg, #385A45, #182C21)",
      display: "grid",
      placeItems: "center",
      overflow: "hidden",
      boxShadow: "0 10px 30px rgba(0,0,0,.2)",
    }}
  >
    {profile?.avatar_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatar_url}
        alt="Player avatar"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    ) : (
      <UserRound size={45} color={gold} strokeWidth={1.3} />
    )}
  </div>

  <input
    ref={avatarInputRef}
    type="file"
    accept="image/png,image/jpeg,image/webp,image/gif"
    onChange={handleAvatarUpload}
    disabled={uploadingAvatar}
    style={{ display: "none" }}
  />

  <button
    type="button"
    title="Upload profile photo"
    aria-label="Upload profile photo"
    disabled={uploadingAvatar}
    onClick={() => avatarInputRef.current?.click()}
    style={{
      position: "absolute",
      right: -7,
      bottom: -7,
      width: 36,
      height: 36,
      borderRadius: 12,
      display: "grid",
      placeItems: "center",
      background: gold,
      color: "#172017",
      border: "3px solid #172820",
      cursor: uploadingAvatar ? "wait" : "pointer",
      opacity: uploadingAvatar ? 0.65 : 1,
    }}
  >
    {uploadingAvatar ? (
      <LoaderCircle
        size={17}
        style={{ animation: "spin 1s linear infinite" }}
      />
    ) : (
      <Camera size={17} />
    )}
  </button>
</div>
              <div>
                <p
                  style={{
                    margin: "0 0 8px",
                    color: gold,
                    fontSize: 10,
                    letterSpacing: 3,
                    fontWeight: 700,
                  }}
                >
                  YOUR CHESS IDENTITY
                </p>

                <h1
                  style={{
                    margin: "0 0 7px",
                    fontSize: "clamp(26px, 5vw, 37px)",
                    letterSpacing: -1,
                    overflowWrap: "anywhere",
                  }}
                >
                  {profile?.username ?? "Chess Player"}
                </h1>

                <p
                  style={{
                    margin: 0,
                    color: muted,
                    fontSize: 13,
                    overflowWrap: "anywhere",
                  }}
                >
                  {email}
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: 7,
                    alignItems: "center",
                    color: "#C5D9CA",
                    fontSize: 11,
                    marginTop: 12,
                  }}
                >
                  <ShieldCheck size={15} color="#8DC7A0" />
                  Authenticated player
                </div>
              </div>
            </div>

            {!editing && (
              <button
                type="button"
                style={buttonStyle}
                onClick={() => {
                  setUsername(profile?.username ?? "");
                  setEditing(true);
                  setError("");
                  setNotice("");
                }}
              >
                <Pencil size={14} />
                Edit profile
              </button>
            )}
          </div>

          {editing && (
            <form
              onSubmit={saveProfile}
              style={{
                display: "grid",
                gap: 12,
                marginTop: 28,
                paddingTop: 22,
                borderTop: `1px solid ${border}`,
              }}
            >
              <label
                htmlFor="profile-username"
                style={{ color: muted, fontSize: 12 }}
              >
                Player username
              </label>

              <input
                id="profile-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                minLength={3}
                maxLength={24}
                pattern="[A-Za-z0-9_]{3,24}"
                required
                autoComplete="username"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: 13,
                  background: "#0D1912",
                  color: ivory,
                  border: `1px solid ${border}`,
                  borderRadius: 10,
                  fontSize: 14,
                }}
              />

              <p style={{ margin: 0, color: muted, fontSize: 11 }}>
                Use 3–24 letters, numbers, or underscores. Usernames must be
                unique.
              </p>

              <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    ...buttonStyle,
                    background: gold,
                    color: "#172017",
                    borderColor: gold,
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? (
                    <LoaderCircle size={15} />
                  ) : (
                    <Check size={15} />
                  )}
                  {saving ? "Saving..." : "Save changes"}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  style={buttonStyle}
                  onClick={() => {
                    setEditing(false);
                    setUsername(profile?.username ?? "");
                    setError("");
                  }}
                >
                  <X size={15} />
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: 20,
              padding: 15,
              background: "rgba(160,53,53,.15)",
              border: "1px solid rgba(255,120,120,.25)",
              borderRadius: 12,
              color: "#FFC1B8",
              fontSize: 13,
              lineHeight: 1.6,
              overflowWrap: "anywhere",
            }}
          >
            {error}
            <button
              type="button"
              onClick={() => void loadProfile()}
              style={{
                ...buttonStyle,
                display: "flex",
                marginTop: 12,
              }}
            >
              Retry loading profile
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            style={{
              marginBottom: 20,
              padding: 13,
              borderRadius: 10,
              background: "rgba(67,145,91,.13)",
              border: "1px solid rgba(130,204,151,.25)",
              color: "#B5E8C4",
              fontSize: 13,
            }}
          >
            {notice}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 13,
            marginBottom: 22,
          }}
        >
          {[
            {
              label: "CHESS RATING",
              value: profile?.rating ?? 1200,
              note: "Current rating",
              icon: <Trophy size={19} />,
              color: gold,
            },
            {
              label: "GAMES PLAYED",
              value: gamesPlayed,
              note: "Completed games",
              icon: <Swords size={19} />,
              color: "#9DD7B2",
            },
            {
              label: "WIN RATE",
              value: `${winRate}%`,
              note: "Of recorded games",
              icon: <Target size={19} />,
              color: "#B6C8EB",
            },
            {
              label: "WINS",
              value: profile?.wins ?? 0,
              note: "Recorded victories",
              icon: <Crown size={19} />,
              color: "#E6D6A7",
            },
          ].map((stat) => (
            <article
              key={stat.label}
              style={{
                background: panel,
                border: `1px solid ${border}`,
                borderRadius: 16,
                padding: 19,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 17,
                }}
              >
                <span
                  style={{
                    color: muted,
                    fontSize: 9,
                    letterSpacing: 1.5,
                    fontWeight: 700,
                  }}
                >
                  {stat.label}
                </span>
                <span style={{ color: stat.color }}>{stat.icon}</span>
              </div>

              <div
                style={{
                  color: ivory,
                  fontSize: 29,
                  fontWeight: 700,
                  marginBottom: 6,
                  overflowWrap: "anywhere",
                }}
              >
                {stat.value}
              </div>

              <div style={{ color: muted, fontSize: 11 }}>{stat.note}</div>
            </article>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 18,
          }}
        >
          <section
            style={{
              background: panel,
              border: `1px solid ${border}`,
              borderRadius: 17,
              padding: 23,
            }}
          >
            <h2
              style={{
                margin: "0 0 19px",
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                gap: 9,
              }}
            >
              <Trophy color={gold} size={18} />
              Match record
            </h2>

            {[
              { label: "Wins", value: profile?.wins ?? 0, color: "#9DD7B2" },
              {
                label: "Losses",
                value: profile?.losses ?? 0,
                color: "#E49B92",
              },
              { label: "Draws", value: profile?.draws ?? 0, color: "#B6C8EB" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  borderBottom: `1px solid ${border}`,
                  fontSize: 13,
                }}
              >
                <span style={{ color: muted }}>{item.label}</span>
                <strong style={{ color: item.color }}>{item.value}</strong>
              </div>
            ))}

            <p
              style={{
                color: muted,
                fontSize: 11,
                lineHeight: 1.6,
                margin: "15px 0 0",
              }}
            >
              Statistics will update as completed matches are recorded in
              Chess Victor.
            </p>
          </section>

          <section
            style={{
              background: panel,
              border: `1px solid ${border}`,
              borderRadius: 17,
              padding: 23,
            }}
          >
            <h2
              style={{
                margin: "0 0 19px",
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                gap: 9,
              }}
            >
              <CalendarDays color={gold} size={18} />
              Player details
            </h2>

            <div style={{ marginBottom: 18 }}>
              <p
                style={{
                  color: muted,
                  fontSize: 10,
                  letterSpacing: 1,
                  margin: "0 0 7px",
                }}
              >
                MEMBER SINCE
              </p>
              <strong style={{ fontSize: 14 }}>{joinedDate}</strong>
            </div>

            <div style={{ marginBottom: 20 }}>
              <p
                style={{
                  color: muted,
                  fontSize: 10,
                  letterSpacing: 1,
                  margin: "0 0 7px",
                }}
              >
                ACCOUNT EMAIL
              </p>
              <p
                style={{
                  fontSize: 13,
                  margin: 0,
                  overflowWrap: "anywhere",
                }}
              >
                {email}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              style={{
                ...buttonStyle,
                width: "100%",
                boxSizing: "border-box",
                color: "#E9B0A8",
                background: "rgba(160,53,53,.1)",
                borderColor: "rgba(220,110,100,.2)",
                opacity: signingOut ? 0.7 : 1,
              }}
            >
              <LogOut size={15} />
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </section>
        </div>

        <footer
          style={{
            textAlign: "center",
            color: "#70877A",
            fontSize: 11,
            paddingTop: 30,
            letterSpacing: 1,
          }}
        >
          CHESS VICTOR · PLAY SMART · THINK AHEAD
        </footer>
      </div>
    </main>
  );
}