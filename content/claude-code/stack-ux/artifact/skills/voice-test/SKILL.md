---
name: voice-test
description: Use when testing voice interviews, debugging Gemini Live audio issues, verifying voice session quality, or running automated voice QA. Also use when the user mentions "voice test", "test voice", "voice sim", "interview audio", or wants to simulate candidates speaking.
---

# Voice Interview Testing

## Overview

Automated end-to-end voice interview testing using `apps/qa-agent/voice_sim.py`. Simulates real candidates by generating speech audio via TTS, sending PCM frames over WebSocket to the voice server, and receiving AI interviewer responses through Gemini Live.

## Prerequisites

```bash
# 1. Dev server running
npm run dev  # http://localhost:3000

# 2. Voice server running
npm run voice-server:dev  # ws://localhost:5876

# 3. Docker (Postgres + Redis)
npm run docker:dev

# 4. Environment
STAGE_SESSION_DEV_BYPASS=true   # in .env — bypasses candidate cookie auth
OPENROUTER_API_KEY=...          # for candidate brain LLM
GOOGLE_APPLICATION_CREDENTIALS=... # for Google Cloud TTS
```

## Quick Start

```bash
cd apps/qa-agent
source .venv/bin/activate

# Run a single persona test
python voice_sim.py --session <session-id> --persona high --turns 4

# Personas: exceptional, high, medium, low, cheating
```

## Session Setup

Test sessions need these DB fields set:

| Field | Value | Why |
|-------|-------|-----|
| `status` | `ACTIVE` | Session must be active |
| `started_at` | `NOW()` | Skips MediaSetup dialog |
| `turnstile_verified_at` | `NOW()` | Bypasses Turnstile check on voice endpoint |
| `audio_enabled` | `true` | Enables voice path |
| `transcript` | `[]` | Clean slate |
| `response` | `NULL` | Clean slate |

```sql
UPDATE stage_sessions SET
  status = 'ACTIVE', started_at = NOW(), turnstile_verified_at = NOW(),
  completed_at = NULL, score = NULL, scoring_breakdown = NULL, ai_summary = NULL,
  evaluated_at = NULL, evaluated_by = NULL, transcript = '[]', response = NULL
WHERE id = '<session-id>';
```

Session IDs must be **CUID-like** (no hyphens, <30 chars) for the page to recognize them as sessions vs invitation tokens.

## Personas

| Persona | Behavior | Use For |
|---------|----------|---------|
| `exceptional` | Deep technical, references real experience, proactive | Testing long-response handling, turn-taking |
| `high` | Solid answers, good structure, occasional "let me think" | Baseline quality verification |
| `medium` | Hesitant, filler words, decent knowledge | VAD sensitivity, filler handling |
| `low` | Vague, short, "I'm not sure", wrong answers | Graceful interviewer adaptation |
| `cheating` | Suspiciously perfect, unnatural pauses, textbook tone | Detection behavior verification |

## What It Tests

The full audio pipeline end-to-end:

```
LLM (candidate brain) → Google TTS → PCM 16kHz Int16 → Base64 → WebSocket
→ Voice Server → Gemini Live (STT + LLM + native audio) → WebSocket
→ Transcript + Audio back to simulator
```

## Key Metrics in Output

- **LLM response time**: How fast the candidate brain generates text (target: <3s)
- **TTS generation time**: Google Cloud TTS latency (target: <8s)
- **AI response latency**: Time from end-of-speech to AI speaking (target: <3s)
- **Turn count**: How many exchanges completed before timeout/error
- **Connection stability**: WebSocket reconnects, "Connection lost" errors

## Evaluation After Voice Test

After a voice interview completes, test the full scoring pipeline:

```bash
# 1. Complete the session
curl -X POST http://localhost:3000/api/stage-session/<session-id>/complete \
  -H "x-internal-api-key: $INTERNAL_API_KEY"

# 2. Trigger evaluation (needs Aegra running on port 8005)
cd langgraph-agents && make aegra-run  # Start LangGraph server

# 3. Check results in DB
docker exec interviewlm-postgres-dev psql -U postgres -d interviewlm \
  -c "SELECT score, evaluated_at FROM stage_sessions WHERE id = '<session-id>'"
```

**IMPORTANT**: Port 8005 (Aegra) is the correct LangGraph server. Port 2024 is a DIFFERENT project.

Expected score differentiation:
| Persona | Score Range | Integrity |
|---------|-------------|-----------|
| exceptional | 75-85 | May flag fast responses (40-60) |
| high | 70-82 | Clean (80-95) |
| medium | 50-70 | Clean |
| low | 20-45 | Clean |

## Known Issues to Watch For

1. **Keepalive timeout on long TTS**: Audio >900KB can trigger `sent 1011 keepalive ping timeout`. Happens on 12-turn tests with exceptional persona. Not yet fixed.
2. **Tool call loops**: `get_next_topic` called 15+ times. Existing breaker handles it, but indicates Gemini confusion.
3. **Interviewer re-introduces**: Gemini sometimes says "Hi, I'm [name]" again on turn 2.

## Iterative Fix-Test Loop

```
1. Run voice_sim.py with target persona
2. Read transcript + metrics in results/voice-sim/
3. Identify issue (latency, dropped turn, error)
4. Fix in voice server or frontend code
5. Reset session (SQL UPDATE above)
6. Re-run same test
7. Compare results — repeat until clean
```

## Output

Results saved to `apps/qa-agent/results/voice-sim/<session>-<persona>-<timestamp>/`:
- `conversation.json`. Full transcript with timing metrics
- `interview.wav`. Combined audio (AI + candidate), 24kHz mono, with 0.5s silence between turns

Listen to the WAV to verify: natural turn-taking, no stuttering, question variety, appropriate interview flow.

## Resolved Issues (Fixed)

- **Gemini silent turns**: Empty `turnComplete` with no speech. Fixed with immediate nudge + retry (up to 3) in `gemini-live.ts`
- **Question repetition**: Gemini re-asked covered topics. Fixed with explicit "NEVER repeat" in system instruction + covered topic context in tool responses
- **Audio stuttering in WAV**: Per-chunk saving caused gaps. Fixed with per-turn buffering in `voice_sim.py`

## Common Fixes

| Symptom | Likely Cause | Fix Location |
|---------|-------------|--------------|
| 403 on /voice endpoint | Turnstile expired or missing | Set `turnstile_verified_at` in DB, or set `STAGE_SESSION_DEV_BYPASS=true` in .env |
| 403 on WebSocket | Missing Origin header | Voice server ALLOWED_ORIGINS |
| 500 on /voice endpoint | Webpack hot-reload | Restart `npm run dev` |
| MediaSetup blocks | `started_at` is NULL | Set in DB |
| Gemini silent after long speech | Turn-taking mute gate | Check `gemini-live.ts` mute logic |
| Evaluation ECONNREFUSED | Aegra not running | `cd langgraph-agents && make aegra-run` (port 8005) |
| No score after complete | Worker didn't pick up job | Check Redis running, check worker logs |
