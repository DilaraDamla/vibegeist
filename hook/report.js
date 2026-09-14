#!/usr/bin/env node
// Called by a Claude Code hook. Reads the hook's stdin JSON, extracts session_id,
// and reports one anonymized event to the vibegeist server. Never throws —
// a reporting failure must never break the user's Claude Code session.

import { appendFileSync } from 'node:fs';

const SERVER_URL = process.env.VIBEGEIST_SERVER || 'https://vibegeist.dayloop-dilara.workers.dev';
const EVENT_TYPE = process.argv[2]; // 'join' | 'activity' | 'ghost'
const DEBUG_LOG = process.env.VIBEGEIST_DEBUG_LOG || 'C:/Users/serda/vibegeist-hook-debug.log';

function debugLog(line) {
  if (!DEBUG_LOG) return;
  try {
    appendFileSync(DEBUG_LOG, `${new Date().toISOString()} ${line}\n`);
  } catch {
    // ignore
  }
}

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', async () => {
  debugLog(`invoked type=${EVENT_TYPE} rawLen=${input.length} raw=${JSON.stringify(input.slice(0, 200))}`);
  try {
    // PowerShell prepends a UTF-8 BOM when piping text into a child process's
    // stdin - strip it, or JSON.parse throws and the whole event is silently lost
    const clean = input.replace(/^﻿/, '').trim();
    const payload = JSON.parse(clean || '{}');
    const sessionId = payload.session_id;
    if (!sessionId || !EVENT_TYPE) {
      debugLog(`skip: sessionId=${sessionId} EVENT_TYPE=${EVENT_TYPE}`);
      return;
    }

    const res = await fetch(`${SERVER_URL}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, type: EVENT_TYPE }),
      signal: AbortSignal.timeout(2000),
    });
    debugLog(`sent ok, status=${res.status}`);
  } catch (err) {
    debugLog(`error: ${err && err.stack ? err.stack : err}`);
  }
});
