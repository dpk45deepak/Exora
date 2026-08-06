# User Guide

## For students

**What's being monitored, and why.** This system does not record video or
audio, and it never sees the actual words you type. It watches the *timing*
of your keystrokes (how long you hold each key, how fast you move between
keys) to build a baseline of your normal typing rhythm during the first
part of the exam. If that rhythm changes dramatically later — which can
happen if someone else takes over typing, or text is pasted in from another
source — it's flagged for your instructor to review, not auto-penalized.

**What triggers a flag:**
- A significant, sustained shift in keystroke rhythm compared to your own
  baseline from earlier in the same exam.
- Pasting text into the answer field.
- Switching away from the exam tab/window (each occurrence is logged with a
  timestamp).

**What does *not* trigger a flag:**
- Typing normally, including natural fatigue-related slowdowns — the
  detector is tuned against your own baseline variance, not a fixed speed.
- Thinking pauses (no keystrokes ≠ an anomaly signal).

**Starting an exam session:**
1. Open the exam link provided by your instructor.
2. The session status indicator (top right) will show "Connecting…" then
   "Session monitored" once telemetry capture is active.
3. Type your answers normally. The first ~7–8 minutes establish your
   baseline; scoring begins after that.
4. Click "Save & continue" to move between questions.

## For instructors

**Dashboard overview** (`/dashboard`): every exam session, live status
(`ACTIVE`, `FLAGGED`, `SUBMITTED`, etc.), anomaly count, focus-loss count,
and ledger block count. Refreshes automatically every 10 seconds.

**Investigating a flagged session:**
1. Click "View session" on any row.
2. The timeline shows every recorded event in order, with anomaly scores
   and the cryptographic hash of the ledger block it produced.
3. Click **"Verify cryptographic integrity"** to re-walk the entire hash
   chain for that session. This independently confirms that no event was
   added, removed, or altered after the fact — you don't have to take the
   database's word for it; the verification recomputes every hash from
   scratch.

**Interpreting an anomaly score:** the number itself (reconstruction loss)
isn't meaningful in isolation — what matters is whether it exceeds that
student's own `threshold`, shown alongside it. A flagged event means the
student's typing rhythm in that window didn't match their own earlier
baseline; it is a signal to review, not proof of misconduct. Treat it the
same way you'd treat any single piece of evidence — corroborate with the
focus-loss timeline, paste events, and the actual submitted answer before
drawing conclusions.

**A note on false positives:** any anomaly detector has some false-positive
rate. Legitimate explanations for a flagged rhythm shift include switching
input devices mid-exam, a hand injury, or unrelated interruptions. The
system is designed to surface signal for human review, not to auto-fail
students.
