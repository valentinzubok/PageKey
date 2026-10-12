"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CHAIN_ID,
  CONTRACT_ADDRESS,
  CONTRACT_REPO,
  DEMO_URL,
  EXPLORER,
  GITHUB,
  txUrl,
} from "@/lib/config";
import {
  challengeFor,
  claim,
  getBinding,
  getEvents,
  getSchedule,
  getStats,
  listUrls,
  recheck,
  release,
  type Binding,
  type EventRow,
  type Schedule,
  type Stats,
} from "@/lib/contracts";
import { fundWithTestGen, getNativeBalance, type TxStage } from "@/lib/genlayer";
import { useWallet } from "./WalletProvider";

const short = (h: string, n = 10) => (h ? `${h.slice(0, n)}…${h.slice(-4)}` : "—");
const utc = (seconds: number) =>
  seconds ? `${new Date(seconds * 1000).toISOString().replace("T", " ").slice(0, 16)} UTC` : "—";
const span = (seconds: number) =>
  seconds >= 86400
    ? `${Math.round(seconds / 8640) / 10} d`
    : seconds >= 3600
      ? `${Math.round(seconds / 360) / 10} h`
      : `${Math.round(seconds / 6) / 10} min`;

const RESULT: Record<string, string> = {
  claimed: "claimed · the page says so",
  own: "confirmed · page changed, judged again",
  unchanged: "confirmed · page unchanged, no model asked",
  absent: "token not on the page · a miss",
  not_own: "token there, but not in the page's own voice · a miss",
  unreachable: "page unreachable",
};

const STATUS: Record<string, string> = {
  active: "bound",
  lapsed: "lapsed · the page stopped saying so",
  released: "released by the holder",
};

/** Hero illustration: where the token sits decides everything. */
function Voices() {
  return (
    <div className="roundsbox" aria-hidden="true">
      <p className="q">Who published the token on this page?</p>
      <div className="lane">
        <span>bio</span>
        <span className="bar yes">“my wallet: pagekey-2e5e…” → bound</span>
      </div>
      <div className="lane">
        <span>comment</span>
        <span className="bar no">guest_4471: “pagekey-cf92…” → refused</span>
      </div>
      <div className="lane">
        <span>copied</span>
        <span className="bar no">someone else&apos;s token → not even judged</span>
      </div>
      <p className="gap">⋮ rechecked on a fixed interval</p>
      <div className="lane">
        <span>later</span>
        <span className="bar final">token removed → the binding lapses</span>
      </div>
    </div>
  );
}

export function PageKeyApp() {
  const { address, provider, connect, error: walletError } = useWallet();
  const [rows, setRows] = useState<Binding[]>([]);
  const [schedules, setSchedules] = useState<Record<string, Schedule>>({});
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [gen, setGen] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [tx, setTx] = useState("");
  const [stage, setStage] = useState<TxStage | "">("");

  const [url, setUrl] = useState(DEMO_URL);
  const [interval, setIntervalSeconds] = useState("300");
  const [misses, setMisses] = useState("2");
  const [token, setToken] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [urls, s, ev] = await Promise.all([listUrls(), getStats(), getEvents()]);
      setStats(s);
      setEvents(ev.slice(-10).reverse());
      const loaded = await Promise.all(urls.map((u) => getBinding(u)));
      setRows((loaded.filter(Boolean) as Binding[]).reverse());
      const sched = await Promise.all(urls.map((u) => getSchedule(u)));
      setSchedules(
        Object.fromEntries(sched.filter(Boolean).map((x) => [(x as Schedule).url, x as Schedule])),
      );
      if (address) setGen(await getNativeBalance(address));
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "read failed"}`);
      setOk(false);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The token is a free view of (url, address): show it as soon as both are known.
  useEffect(() => {
    let live = true;
    setToken("");
    if (address && /^https:\/\/\S+$/.test(url.trim())) {
      challengeFor(url.trim(), address)
        .then((t) => live && setToken(t))
        .catch(() => undefined);
    }
    return () => {
      live = false;
    };
  }, [url, address]);

  /** ACCEPTED and FINALIZED are different guarantees, so the UI shows both. */
  const onStage = (next: TxStage, hash: string) => {
    setTx(hash);
    setStage(next);
    if (next === "finalized") void refresh();
  };

  const run = async (name: string, fn: () => Promise<string | void>) => {
    if (!address || !provider) {
      setMsg("Connect MetaMask for writes");
      setOk(false);
      return;
    }
    setBusy(name);
    setMsg("");
    setStage("");
    try {
      const hash = await fn();
      if (hash) setTx(hash);
      await refresh();
      setMsg(`${name}: accepted by consensus — the result is in the list below`);
      setOk(true);
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setOk(false);
    } finally {
      setBusy("");
    }
  };

  const acct = address as `0x${string}`;
  const disabled = !!busy || !address;
  const same = (a: string, b: string | null) => !!b && a.toLowerCase() === b.toLowerCase();
  const target = schedules[url.trim()];

  return (
    <main className="wrap">
      <section className="hero">
        <div>
          <h1>
            Page<span className="accent">Key</span>
          </h1>
          <p className="lede">
            “This address belongs to whoever runs that page” is usually a badge somebody hands
            out. Here it is a fact other contracts can read. You publish a token on a page you
            control, and the binding exists only when{" "}
            <strong>validators agree the page itself says so</strong> — not a visitor comment, not
            a quote, not a token copied from someone else. The network looks again on a fixed
            interval, and a page that stops saying so loses the binding.
          </p>
          <div className="chips">
            <span className="chip">
              chain <b>{CHAIN_ID}</b>
            </span>
            {stats && (
              <>
                <span className="chip">
                  pages <b>{stats.pages}</b>
                </span>
                <span className="chip hot">
                  bound <b>{stats.by_status.active || 0}</b>
                </span>
                <span className="chip">
                  lapsed <b>{stats.by_status.lapsed || 0}</b>
                </span>
              </>
            )}
          </div>
          <p className="muted" style={{ marginTop: "0.8rem" }}>
            Contract <a href={EXPLORER}>{short(CONTRACT_ADDRESS, 12)}</a> · no owner, no issuer ·{" "}
            <a href={CONTRACT_REPO}>contract source</a> · <a href={GITHUB}>this console</a>
          </p>
          <div>
            {!address ? (
              <button onClick={() => void connect()}>Connect MetaMask</button>
            ) : (
              <span className="pill">
                <span className="dot" /> {short(address)} · {gen || "?"} GEN
              </span>
            )}
            {address && (
              <button
                className="ghost"
                style={{ marginLeft: "0.5rem" }}
                disabled={!!busy}
                onClick={() =>
                  void run("Get test GEN", async () => {
                    await fundWithTestGen(acct);
                  })
                }
              >
                Get test GEN
              </button>
            )}
          </div>
          {walletError && <p className="msg">{walletError}</p>}
          {msg && <p className={ok ? "okmsg" : "msg"}>{msg}</p>}
          {tx && (
            <p className="tx muted">
              last tx <a href={txUrl(tx)}>{short(tx, 14)}</a>{" "}
              {stage === "finalized" ? (
                <span className="stagepill final">finalized</span>
              ) : (
                <span className="stagepill accepted">accepted — awaiting finalization</span>
              )}
            </p>
          )}
        </div>
        <Voices />
      </section>

      <div className="row">
        <section className="card">
          <h2>1 · Bind a page to your wallet</h2>
          <p className="muted">
            Enter a page you can edit. The token below is derived from the page and from your
            address, so it is useless to anyone else. Put it in the page&apos;s own content, then
            claim.
          </p>
          <label htmlFor="url">Page (https)</label>
          <input id="url" value={url} onChange={(e) => setUrl(e.target.value)} />
          <label>Your token for this page</label>
          <p className="verdictbox">
            {token ? (
              <>
                <code>PageKey: {token}</code>{" "}
                <button
                  className="ghost tiny"
                  onClick={() => void navigator.clipboard.writeText(`PageKey: ${token}`)}
                >
                  copy
                </button>
              </>
            ) : (
              "Connect a wallet and enter an https page to see the token."
            )}
          </p>
          <div className="grid2">
            <div>
              <label htmlFor="interval">Recheck interval (s)</label>
              <input
                id="interval"
                value={interval}
                onChange={(e) => setIntervalSeconds(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="misses">Misses in a row that lapse it (1–6)</label>
              <input id="misses" value={misses} onChange={(e) => setMisses(e.target.value)} />
            </div>
          </div>
          <p className="muted">
            Both numbers are fixed by this claim and have no setter. With these values a page
            that drops the token stays bound for at most{" "}
            {span((Number(misses) || 0) * (Number(interval) || 0))} of rechecks. A refused claim
            binds nothing; you can try again after a minute.
          </p>
          <button
            disabled={disabled || !token || (target ? !target.can_claim : false)}
            onClick={() =>
              void run("claim", () => claim(acct, provider, url.trim(), interval, misses, onStage))
            }
          >
            {busy === "claim" ? (
              <span className="working">
                <span className="spinner" /> validators are reading the page…
              </span>
            ) : target && !target.can_claim ? (
              "this page is already bound"
            ) : (
              "claim this page"
            )}
          </button>
        </section>

        <section className="card">
          <h2>2 · What a check decides</h2>
          <ul className="decide">
            <li>
              <span className="tag">absent</span> the token is not on the page. Counted in code
              over the whole page; no model is asked.
            </li>
            <li>
              <span className="tag">own</span> validators agree the token is part of the
              page&apos;s own content: a bio, a profile field, a statement by the author.
            </li>
            <li>
              <span className="tag">not own</span> the token is there, but in a visitor comment, a
              quote, a list of other people&apos;s tokens or a code sample. Doubt resolves here.
            </li>
            <li>
              <span className="tag">unchanged</span> on a recheck, a page byte-identical to the one
              already verified is confirmed without a model.
            </li>
            <li>
              <span className="tag">unreachable</span> the first outage is only noted; a second in
              a row is a miss. An outage never refreshes a binding.
            </li>
            <li>
              <span className="tag">reverts</span> a malformed model answer or a consensus failure
              records nothing.
            </li>
          </ul>
          <p className="muted">
            Another contract reads <code>is_bound(url, address, max_age)</code> and chooses its
            own <code>max_age</code>: a binding nobody has rechecked lately is not a binding.
          </p>
        </section>
      </div>

      <section style={{ marginTop: "2rem" }}>
        <div className="head">
          <h2>Pages on chain</h2>
          <button className="ghost" disabled={loading} onClick={() => void refresh()}>
            {loading ? "reading…" : "refresh"}
          </button>
        </div>
        {rows.length === 0 && !loading && <p className="muted">No pages yet.</p>}
        {rows.map((b) => {
          const s = schedules[b.url];
          const active = b.status === "active";
          return (
            <article className="card" key={b.url} style={{ marginTop: "1rem" }}>
              <div className="head">
                <span className="id">{STATUS[b.status] || b.status}</span>
                <span className="muted">
                  holder #{b.epoch} · {b.checks} check(s)
                </span>
              </div>
              <p className="hashline">
                page <a href={b.url}>{b.url}</a>
              </p>
              <p className="claimtext">
                {active ? "bound to " : "was bound to "}
                {short(b.holder, 12)}
              </p>
              <p className="hashline">
                token <code>{b.token}</code> · bound {utc(b.bound_at)} · last seen saying so{" "}
                {utc(b.last_seen_at)}
              </p>
              <p className="hashline">
                rechecks ≥ {span(b.recheck_interval)} apart · misses {b.misses}/{b.misses_to_lapse}
                {active && <> · next recheck from {utc(b.next_recheck_at)}</>}
              </p>
              <div className="outcomes">
                {b.history.map((h, i) => (
                  <span
                    key={i}
                    className={`outcome ${["claimed", "own", "unchanged"].includes(h.result) ? "final" : ""}`}
                  >
                    {RESULT[h.result] || h.result}
                    <small>
                      {utc(h.at)}
                      {h.content_hash ? ` · sha-256 ${h.content_hash.slice(0, 10)}…` : ""}
                    </small>
                  </span>
                ))}
              </div>
              {b.injection_flags.length > 0 && (
                <p className="hashline">
                  instruction-like text flagged to the validators: {b.injection_flags.join(", ")}
                </p>
              )}
              {active && (
                <button
                  className="ghost"
                  disabled={disabled || (s ? !s.can_recheck : false)}
                  onClick={() => void run("recheck", () => recheck(acct, provider, b.url, onStage))}
                >
                  {s && !s.can_recheck ? "recheck not accepted yet" : "ask the network to look again"}
                </button>
              )}
              {active && same(b.holder, address) && (
                <button
                  className="ghost"
                  style={{ marginLeft: "0.5rem" }}
                  disabled={disabled}
                  onClick={() => void run("release", () => release(acct, provider, b.url, onStage))}
                >
                  release this page
                </button>
              )}
              {!active && (
                <button className="ghost" onClick={() => setUrl(b.url)}>
                  this page is free — claim it above
                </button>
              )}
            </article>
          );
        })}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Recent events</h2>
        {events.length === 0 ? (
          <p className="muted">No events yet.</p>
        ) : (
          <ul className="timeline">
            {events.map((e, i) => (
              <li
                key={i}
                className={
                  e.event === "ClaimRefused" || (e.event === "Rechecked" && e.misses) ? "broken" : ""
                }
              >
                <strong>{String(e.event)}</strong>{" "}
                <span className="muted">
                  {[
                    e.event === "Claimed"
                      ? "the page says so"
                      : e.result
                        ? RESULT[String(e.result)] || e.result
                        : null,
                    e.by ? short(String(e.by)) : null,
                    e.status,
                    String(e.url || "").replace(/^https:\/\//, "").slice(0, 60),
                    typeof e.at === "number" ? utc(e.at) : null,
                  ]
                    .filter(Boolean)
                    .map(String)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="foot">
        PageKey on GenLayer Studio Dev (chain {CHAIN_ID}). Reads work without a wallet; writes need
        MetaMask and test GEN for fees. The demo pages are files in this repository, so every
        change to them is a public commit. Contract source: <a href={CONTRACT_REPO}>PageKeyCore</a>.
      </footer>
    </main>
  );
}
