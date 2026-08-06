import { describe, it, expect, beforeEach } from "vitest";
import { computeBlockHash, GENESIS_HASH } from "../src/ledger/ledgerService.js";

describe("computeBlockHash", () => {
  const base = {
    previousHash: GENESIS_HASH,
    eventId: "evt-1",
    sessionId: "sess-1",
    kind: "TELEMETRY_BATCH",
    payload: { pasteCount: 0, focusLossCount: 1 },
    timestampIso: "2026-08-06T12:00:00.000Z",
  };

  it("is deterministic for identical input", () => {
    expect(computeBlockHash(base)).toBe(computeBlockHash({ ...base }));
  });

  it("produces a 64-character hex SHA-256 digest", () => {
    const hash = computeBlockHash(base);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes if the payload is tampered with", () => {
    const original = computeBlockHash(base);
    const tampered = computeBlockHash({ ...base, payload: { pasteCount: 99, focusLossCount: 1 } });
    expect(tampered).not.toBe(original);
  });

  it("changes if previousHash link is altered", () => {
    const original = computeBlockHash(base);
    const tampered = computeBlockHash({ ...base, previousHash: "f".repeat(64) });
    expect(tampered).not.toBe(original);
  });

  it("changes if timestamp is altered", () => {
    const original = computeBlockHash(base);
    const tampered = computeBlockHash({ ...base, timestampIso: "2026-08-06T12:00:01.000Z" });
    expect(tampered).not.toBe(original);
  });

  it("chains correctly across three sequential blocks", () => {
    const block0Hash = computeBlockHash(base);
    const block1Hash = computeBlockHash({ ...base, previousHash: block0Hash, eventId: "evt-2" });
    const block2Hash = computeBlockHash({ ...base, previousHash: block1Hash, eventId: "evt-3" });

    // Re-deriving from scratch with the same linkage must reproduce identical hashes.
    expect(computeBlockHash({ ...base, previousHash: block0Hash, eventId: "evt-2" })).toBe(block1Hash);
    expect(computeBlockHash({ ...base, previousHash: block1Hash, eventId: "evt-3" })).toBe(block2Hash);
    expect(new Set([block0Hash, block1Hash, block2Hash]).size).toBe(3);
  });
});
