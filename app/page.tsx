"use client"
import Link from "next/link";

const gold = "#d5b56d";
const muted = "#a6b2aa";

export default function LandingPage() {
  return (
    <main className="victor-page">
      <nav className="victor-nav">
        <Link href="/" className="victor-brand">
  <span className="victor-mark">♞</span>
  <span className="victor-brand-text">
    <strong>CHESS VICTOR</strong>
    <small>STRATEGY. SKILL. VICTORY.</small>
  </span>
</Link>

        <div className="victor-nav-actions">
          <Link href="/auth?mode=login" className="victor-login">
            Log in
          </Link>
          <Link href="/auth" className="victor-button">
            Join Chess Victor <span>↗</span>
          </Link>
        </div>
      </nav>

      <section className="victor-hero">
        <div className="victor-copy">
          <div className="victor-eyebrow">
            <span /> THE NEXT MOVE IS YOURS
          </div>

          <h1>
            Think deeper.
            <br />
            Play <span>fearlessly.</span>
          </h1>

          <p className="victor-description">
            Every move tells a story. Challenge your mind, sharpen
            your strategy, and prove your skill on the board.
            Your journey to chess mastery starts here.
          </p>

          <div className="victor-hero-actions">
            <Link href="/auth" className="victor-button victor-primary">
              Start playing <span>→</span>
            </Link>
            <Link href="/auth?mode=login" className="victor-secondary">
              Already a member? Log in
            </Link>
          </div>

          <div className="victor-stats">
            <div>
              <strong>01</strong>
              <span>Think strategically</span>
            </div>
            <div>
              <strong>02</strong>
              <span>Challenge yourself</span>
            </div>
            <div>
              <strong>03</strong>
              <span>Make your move</span>
            </div>
          </div>
        </div>

        <div className="victor-art" aria-label="Chess king illustration">
          <div className="victor-orbit orbit-one" />
          <div className="victor-orbit orbit-two" />
          <div className="victor-glow" />
          <div className="victor-chess-symbol">♚</div>
          <div className="victor-art-label">
            <span>THE ART OF CHESS</span>
            <strong>YOUR MOVE. YOUR LEGACY.</strong>
          </div>
        </div>

        <div className="victor-vertical-label">BUILT FOR THE STRATEGIC MIND</div>
      </section>

      <section className="victor-features">
        <div>
          <span className="feature-number">01 / PLAY</span>
          <h2>Make every move count.</h2>
          <p>Explore the board and put your chess skills to the test.</p>
        </div>
        <div>
          <span className="feature-number">02 / COMPETE</span>
          <h2>Rise through the ranks.</h2>
          <p>Build your profile and track your progress as you improve.</p>
        </div>
        <div>
          <span className="feature-number">03 / MASTER</span>
          <h2>Think beyond the board.</h2>
          <p>Develop your strategy one game and one decision at a time.</p>
        </div>
      </section>

      <footer className="victor-footer">
        <Link href="/" className="footer-brand">CHESS VICTOR</Link>
        <span>Every great victory begins with a move.</span>
        <span>© {new Date().getFullYear()} Chess Victor</span>
      </footer>

      <style jsx>{`
        .victor-page {
          min-height: 100vh;
          overflow: hidden;
          color: #f4f1e8;
          background:
            radial-gradient(ellipse at 76% 36%, #173b2e 0%, transparent 39%),
            radial-gradient(ellipse at 10% 95%, #17271f 0%, transparent 35%),
            #0a100d;
          font-family: Arial, Helvetica, sans-serif;
        }

        .victor-nav {
          min-height: 88px;
          padding: 0 7%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          border-bottom: 1px solid rgba(213, 181, 109, .13);
        }

        .victor-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #f4f1e8;
          text-decoration: none;
        }
.victor-brand {
  flex-shrink: 0;
  gap: 14px;
  white-space: nowrap;
}

.victor-brand-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
}

.victor-brand strong {
  line-height: 1.2;
}

.victor-brand small {
  margin-top: 0;
  line-height: 1.4;
}
        .victor-mark {
          color: ${gold};
          font-size: 38px;
        }

        .victor-brand strong,
        .victor-brand small {
          display: block;
        }

        .victor-brand strong {
          font-size: 14px;
          letter-spacing: 3px;
        }

        .victor-brand small {
          margin-top: 6px;
          color: ${muted};
          font-size: 9px;
          letter-spacing: 2px;
        }

        .victor-nav-actions,
        .victor-hero-actions {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .victor-login,
        .victor-secondary {
          color: #e4e8e1;
          text-decoration: none;
          font-size: 13px;
        }

        .victor-button {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          gap: 14px;
          padding: 14px 20px;
          color: #10150f;
          background: ${gold};
          border: 1px solid ${gold};
          border-radius: 4px;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          transition: transform .2s, background .2s;
        }

        .victor-button:hover {
          transform: translateY(-2px);
          background: #e6ca8c;
        }

        .victor-hero {
          position: relative;
          min-height: 620px;
          padding: 65px 10% 55px;
          display: grid;
          grid-template-columns: 1.05fr .95fr;
          align-items: center;
          gap: 30px;
        }

        .victor-copy {
          position: relative;
          z-index: 2;
          max-width: 610px;
        }

        .victor-eyebrow {
          display: flex;
          align-items: center;
          gap: 10px;
          color: ${gold};
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 3px;
        }

        .victor-eyebrow span {
          width: 24px;
          height: 1px;
          background: ${gold};
        }

        h1 {
          margin: 25px 0 20px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(48px, 6.2vw, 84px);
          font-weight: 400;
          line-height: 1.04;
          letter-spacing: -3px;
        }

        h1 span {
          color: ${gold};
          font-style: italic;
        }

        .victor-description {
          max-width: 450px;
          color: ${muted};
          font-size: 15px;
          line-height: 1.9;
        }

        .victor-hero-actions {
          flex-wrap: wrap;
          gap: 20px;
          margin-top: 30px;
        }

        .victor-primary {
          padding: 17px 24px;
        }

        .victor-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 30px;
          margin-top: 65px;
          padding-top: 23px;
          border-top: 1px solid rgba(213, 181, 109, .18);
        }

        .victor-stats div {
          display: grid;
          gap: 8px;
        }

        .victor-stats strong {
          color: ${gold};
          font-family: Georgia, serif;
          font-size: 23px;
          font-weight: 400;
        }

        .victor-stats span {
          color: ${muted};
          font-size: 11px;
        }

        .victor-art {
          min-height: 440px;
          position: relative;
          display: grid;
          place-items: center;
          isolation: isolate;
        }

        .victor-glow {
          position: absolute;
          width: min(34vw, 390px);
          aspect-ratio: 1;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(213,181,109,.15), rgba(24,68,48,.12) 45%, transparent 72%);
          filter: blur(10px);
        }

        .victor-chess-symbol {
          position: relative;
          z-index: 1;
          color: ${gold};
          font-family: Georgia, serif;
          font-size: clamp(200px, 28vw, 340px);
          line-height: 1;
          text-shadow:
            0 12px 0 rgba(108, 79, 34, .35),
            0 0 70px rgba(213,181,109,.14);
          animation: float 5s ease-in-out infinite;
        }

        .victor-orbit {
          position: absolute;
          width: 90%;
          aspect-ratio: 1;
          border: 1px solid rgba(213,181,109,.12);
          border-radius: 50%;
        }

        .orbit-two {
          width: 70%;
          border-color: rgba(213,181,109,.2);
          transform: rotateX(65deg) rotate(-25deg);
        }

        .victor-art-label {
          position: absolute;
          right: 0;
          bottom: 12px;
          display: grid;
          gap: 8px;
          text-align: right;
        }

        .victor-art-label span,
        .victor-vertical-label,
        .feature-number {
          color: ${gold};
          font-size: 9px;
          letter-spacing: 2px;
        }

        .victor-art-label strong {
          font-size: 11px;
          letter-spacing: 1px;
        }

        .victor-vertical-label {
          position: absolute;
          top: 50%;
          right: 2%;
          writing-mode: vertical-rl;
          color: #718076;
        }

        .victor-features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 35px;
          padding: 55px 10%;
          background: rgba(18, 31, 24, .78);
          border-top: 1px solid rgba(213,181,109,.12);
          border-bottom: 1px solid rgba(213,181,109,.12);
        }

        .victor-features h2 {
          margin: 18px 0 10px;
          font-family: Georgia, serif;
          font-size: 21px;
          font-weight: 400;
        }

        .victor-features p {
          max-width: 290px;
          color: ${muted};
          font-size: 13px;
          line-height: 1.8;
        }

        .victor-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 20px;
          padding: 26px 7%;
          color: #829087;
          font-size: 11px;
        }

        .footer-brand {
          color: ${gold};
          font-size: 11px;
          letter-spacing: 2px;
          text-decoration: none;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }

        @media (max-width: 760px) {
          .victor-nav {
            min-height: 75px;
            padding: 0 5%;
          }

          .victor-brand strong {
            font-size: 11px;
            letter-spacing: 1.5px;
          }

          .victor-brand small {
            font-size: 8px;
            letter-spacing: 1px;
          }

          .victor-mark {
            font-size: 31px;
          }

          .victor-nav-actions {
            gap: 12px;
          }

          .victor-login {
            font-size: 12px;
          }

          .victor-nav-actions .victor-button {
            padding: 12px;
            font-size: 11px;
          }

          .victor-hero {
            grid-template-columns: 1fr;
            padding: 65px 7% 35px;
            gap: 0;
          }

          h1 {
            font-size: clamp(49px, 12vw, 72px);
            letter-spacing: -2px;
          }

          .victor-art {
            min-height: 320px;
          }

          .victor-chess-symbol {
            font-size: 235px;
          }

          .victor-glow {
            width: 270px;
          }

          .victor-vertical-label {
            display: none;
          }

          .victor-stats {
            margin-top: 40px;
            gap: 22px;
          }

          .victor-features {
            grid-template-columns: 1fr;
            gap: 28px;
            padding: 40px 7%;
          }

          .victor-footer {
            padding: 25px 7%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .victor-chess-symbol {
            animation: none;
          }

          .victor-button {
            transition: none;
          }
        }
      `}</style>
    </main>
  );
}
