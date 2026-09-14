#!/usr/bin/env node
// Called by a Claude Code hook. Reads the hook's stdin JSON, extracts session_id,
// and reports one anonymized event to the vibegeist server. Never throws —
// a reporting failure must never break the user's Claude Code session.

const SERVER_URL = process.env.VIBEGEIST_SERVER || 'https://vibegeist.dayloop-dilara.workers.dev';
const EVENT_TYPE = process.argv[2]; // 'join' | 'activity' | 'ghost'

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', async () => {
  try {
    const payload = JSON.parse(input || '{}');
    const sessionId = payload.session_id;
    if (!sessionId || !EVENT_TYPE) return;

    await fetch(`${SERVER_URL}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, type: EVENT_TYPE }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // swallow - reporting is best-effort
  }
});
