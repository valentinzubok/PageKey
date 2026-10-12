import { CONTRACT_ADDRESS } from "./config";
import { type Address, type TxStage, parseJson, readContract, writeAndWait } from "./genlayer";

export type Check = { at: number; result: string; content_hash: string; by: string };

export type Binding = {
  url: string;
  holder: string;
  token: string;
  status: "active" | "lapsed" | "released";
  recheck_interval: number;
  misses_to_lapse: number;
  bound_at: number;
  last_seen_at: number;
  next_recheck_at: number;
  last_result: string;
  verified_hash: string;
  misses: number;
  checks: number;
  epoch: number;
  ended_at?: number;
  injection_flags: string[];
  history: Check[];
};

export type Schedule = {
  url: string;
  status: string;
  now: number;
  next_recheck_at?: number;
  can_claim: boolean;
  can_recheck: boolean;
};

export type Stats = { pages: number; by_status: Record<string, number> };
export type EventRow = { event: string; [key: string]: unknown };

type OnStage = (stage: TxStage, hash: string) => void;
const read = (fn: string, args: string[] = []) => readContract<string>(CONTRACT_ADDRESS, fn, args);

export async function listUrls(): Promise<string[]> {
  return parseJson<string[]>(await read("list_urls"), []);
}

export async function getBinding(url: string): Promise<Binding | null> {
  const parsed = parseJson<Binding>(await read("get_binding", [url]), {} as Binding);
  return parsed.url ? parsed : null;
}

/** What is accepted right now — read it before paying a fee for a call that would revert. */
export async function getSchedule(url: string): Promise<Schedule | null> {
  const parsed = parseJson<Schedule>(await read("get_schedule", [url]), {} as Schedule);
  return parsed.url ? parsed : null;
}

/** The token `address` has to publish on `url`. A free view. */
export async function challengeFor(url: string, address: string): Promise<string> {
  return read("challenge_for", [url, address]);
}

export async function getStats(): Promise<Stats | null> {
  return parseJson<Stats | null>(await read("get_stats"), null);
}

export async function getEvents(): Promise<EventRow[]> {
  return parseJson<EventRow[]>(await read("get_events"), []);
}

export async function claim(
  account: Address,
  provider: unknown,
  url: string,
  recheckInterval: string,
  missesToLapse: string,
  on?: OnStage,
) {
  return writeAndWait(
    account,
    provider,
    CONTRACT_ADDRESS,
    "claim",
    [url, recheckInterval, missesToLapse],
    on,
  );
}

const simple = (fn: string) => (account: Address, provider: unknown, url: string, on?: OnStage) =>
  writeAndWait(account, provider, CONTRACT_ADDRESS, fn, [url], on);

export const recheck = simple("recheck");
export const release = simple("release");
