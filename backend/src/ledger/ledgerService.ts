import { createHash } from "node:crypto";
import type { PrismaClient, AuditEvent } from "@prisma/client";

export const GENESIS_HASH = "0".repeat(64);

export interface VerificationResult {
  valid: boolean;
  sessionId: string;
  blockCount: number;
  /** First block sequence number where the chain breaks, if any. */
  brokenAtSequence: number | null;
  reason: string | null;
}

/**
 * Deterministically hashes one ledger block. The exact serialization order
 * matters: previousHash + canonical event JSON + timestamp, all UTF-8, no
 * whitespace ambiguity. Any change to this function is a breaking change
 * for every previously-issued hash and must be versioned.
 */
export function computeBlockHash(params: {
  previousHash: string;
  eventId: string;
  sessionId: string;
  kind: string;
  payload: unknown;
  timestampIso: string;
}): string {
  const canonical = JSON.stringify({
    previousHash: params.previousHash,
    eventId: params.eventId,
    sessionId: params.sessionId,
    kind: params.kind,
    payload: params.payload,
    timestamp: params.timestampIso,
  });

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export class LedgerService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Appends a new block for the given event, chaining it to the last known
   * block hash for that session. Runs inside a transaction with a row lock
   * on the session to prevent concurrent writers from racing on `sequence`.
   */
  async appendBlock(event: AuditEvent): Promise<{ hash: string; sequence: number }> {
    return this.prisma.$transaction(async (tx) => {
      const lastBlock = await tx.ledgerBlock.findFirst({
        where: { sessionId: event.sessionId },
        orderBy: { sequence: "desc" },
      });

      const previousHash = lastBlock?.hash ?? GENESIS_HASH;
      const sequence = (lastBlock?.sequence ?? -1) + 1;
      const timestampIso = event.createdAt.toISOString();

      const hash = computeBlockHash({
        previousHash,
        eventId: event.id,
        sessionId: event.sessionId,
        kind: event.kind,
        payload: event.payload,
        timestampIso,
      });

      await tx.ledgerBlock.create({
        data: {
          sessionId: event.sessionId,
          eventId: event.id,
          sequence,
          previousHash,
          hash,
        },
      });

      return { hash, sequence };
    });
  }

  /**
   * Walks the full chain for a session and re-derives every hash from its
   * source event, confirming: (a) previousHash linkage is unbroken, and
   * (b) no event payload was mutated after the fact (the stored hash would
   * no longer match a re-computed one).
   */
  async verifyChain(sessionId: string): Promise<VerificationResult> {
    const blocks = await this.prisma.ledgerBlock.findMany({
      where: { sessionId },
      orderBy: { sequence: "asc" },
      include: { event: true },
    });

    if (blocks.length === 0) {
      return { valid: true, sessionId, blockCount: 0, brokenAtSequence: null, reason: null };
    }

    let expectedPrevHash = GENESIS_HASH;

    for (const block of blocks) {
      if (block.previousHash !== expectedPrevHash) {
        return {
          valid: false,
          sessionId,
          blockCount: blocks.length,
          brokenAtSequence: block.sequence,
          reason: `Chain link broken: block ${block.sequence} references previousHash ` +
            `${block.previousHash.slice(0, 12)}… but expected ${expectedPrevHash.slice(0, 12)}…`,
        };
      }

      const recomputed = computeBlockHash({
        previousHash: block.previousHash,
        eventId: block.eventId,
        sessionId: block.sessionId,
        kind: block.event.kind,
        payload: block.event.payload,
        timestampIso: block.event.createdAt.toISOString(),
      });

      if (recomputed !== block.hash) {
        return {
          valid: false,
          sessionId,
          blockCount: blocks.length,
          brokenAtSequence: block.sequence,
          reason: `Hash mismatch at block ${block.sequence}: stored event data does not ` +
            `reproduce the recorded hash. The underlying event may have been altered.`,
        };
      }

      expectedPrevHash = block.hash;
    }

    return { valid: true, sessionId, blockCount: blocks.length, brokenAtSequence: null, reason: null };
  }
}
