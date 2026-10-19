# Chess Mate — Interactive Chess Prototype

**Tagline:** Play Smart. Stake. Win.

A premium dark-luxury chess and player-community prototype for the Nigerian market. Built with Next.js, React, TypeScript, `chess.js`, and Lucide icons. Visual system: deep emerald, charcoal, and metallic gold.

## Run locally

Requirements: Node.js 20+.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Run a production build with `npm run build` after dependencies are installed.

## Prototype features

- Responsive chess club dashboard and navigation.
- Interactive local chessboard with legal moves via `chess.js`, check/checkmate detection, castling, move history, board flip, and queen promotion.
- Rapid, blitz, and bullet clock presets, local practice games, resign confirmation, and draw-offer feedback.
- Demo virtual coin wallet with claimable coins. Virtual coins are non-redeemable and have no cash value.
- Demo tournament, leaderboard, player profile, and friend/private-room flows.
- Community feed with demo posts, like feedback, suggested players, friend-request feedback, and message/reply entry points.
- Real-money mode intentionally disabled.

## Product direction

Chess Mate is intended to launch for Nigeria first. The proposed full product includes free play, non-redeemable virtual coin matches, player rankings, tournaments, one-on-one challenges, player profiles with photos/videos, chat and direct messages, and wallet deposit/withdrawal/transfers. The community and social interactions in this milestone are demo-only; they do not persist or connect users across devices.

## Not implemented / production gates

- Authentication, account recovery, and persistent profiles.
- Server-authoritative multiplayer, matchmaking, realtime chat, media uploads, notifications, and private-room synchronization.
- Production tournament administration, verified ratings, anti-cheat and dispute handling.
- Deposits, withdrawals, transfers, escrow, paid-entry matches, and cash payouts.

Real-money features must remain disabled until Nigerian legal/regulatory advice, age and identity checks as applicable, responsible-play controls, secure payment rails, fraud monitoring, auditable settlement, dispute processes, and anti-cheat protections are implemented and reviewed. A minimum stake of US$1 or equivalent should be treated as a product requirement for later legal review, not an active wager in this prototype.

## Suggested next milestone

1. Add authentication and persistent profiles.
2. Implement secure realtime multiplayer and authoritative clocks.
3. Add persisted social feed, friend requests, and private messaging with reporting/blocking controls.
4. Implement virtual-coin ledger and tournament APIs.
5. Obtain local legal advice and complete compliance/security reviews before considering real-money functionality.
6. Adapt shared API contracts and design tokens for React Native + Expo mobile apps.
