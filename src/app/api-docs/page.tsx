import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Code2, Key, Terminal, Wallet, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Reseller API — PinoyBoosting",
  description:
    "Sell PinoyBoosting services from your own website. Create an API key, top up your wallet, and place orders through one simple endpoint.",
};

const ENDPOINT = "https://pinoyboosting.com/api/v2";

const ACTIONS: Array<{
  action: string;
  params: string;
  returns: string;
}> = [
  { action: "services", params: "—", returns: "The catalog with your prices" },
  { action: "balance", params: "—", returns: "Your wallet balance" },
  {
    action: "add",
    params: "service, link, quantity, idempotency_key (optional)",
    returns: "The new order id",
  },
  { action: "status", params: "order  or  orders", returns: "Status of one or many" },
  { action: "refill", params: "order", returns: "Refill accepted" },
];

const CURL_SAMPLE = `curl -X POST ${ENDPOINT} \\
  -H "Authorization: Bearer pbk_your_key_here" \\
  -d "action=add" \\
  -d "service=1261" \\
  -d "link=https://instagram.com/yourpage" \\
  -d "quantity=1000"`;

const JS_SAMPLE = `const res = await fetch("${ENDPOINT}", {
  method: "POST",
  headers: {
    Authorization: "Bearer pbk_your_key_here",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    action: "add",
    service: 1261,
    link: "https://instagram.com/yourpage",
    quantity: 1000,
  }),
});

const data = await res.json();
console.log(data.order); // the order id`;

const PHP_SAMPLE = `<?php
$ch = curl_init("${ENDPOINT}");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ["Authorization: Bearer pbk_your_key_here"],
  CURLOPT_POSTFIELDS => http_build_query([
    "action"   => "add",
    "service"  => 1261,
    "link"     => "https://instagram.com/yourpage",
    "quantity" => 1000,
  ]),
]);
$data = json_decode(curl_exec($ch), true);
echo $data["order"];`;

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-elevated/50">
        <Code2 size={13} className="text-muted" />
        <span className="text-[10px] font-black uppercase tracking-widest text-muted">
          {title}
        </span>
      </div>
      <pre className="p-4 overflow-x-auto text-[11px] leading-relaxed font-mono text-fg/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={14} /> Website
        </Link>

        <header className="mt-8 mb-10 space-y-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
            <Terminal size={22} className="text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-fg">
            Reseller API
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-muted">
            Sell PinoyBoosting services from your own website. Create a key, top
            up your wallet, and place orders through one endpoint — the same
            shape most SMM panels use, so an existing script can point here
            without a rewrite.
          </p>
        </header>

        <section className="space-y-4 mb-10">
          <h2 className="text-lg font-black text-fg flex items-center gap-2">
            <Zap size={16} className="text-primary" /> Getting started
          </h2>
          <ol className="space-y-3 text-sm leading-7 text-muted list-decimal list-inside">
            <li>
              Sign in and open{" "}
              <Link href="/app/api-access" className="text-primary hover:underline">
                API Access
              </Link>
              .
            </li>
            <li>
              <strong className="text-fg">Top up your wallet.</strong> API orders
              are paid from your balance, so there is no per-order payment step.
            </li>
            <li>
              <strong className="text-fg">Create a key</strong> and copy it
              immediately — it is shown only once.
            </li>
            <li>
              Send it on every request as{" "}
              <code className="px-1.5 py-0.5 rounded bg-elevated font-mono text-[11px] text-fg">
                Authorization: Bearer YOUR_KEY
              </code>
            </li>
          </ol>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-lg font-black text-fg flex items-center gap-2">
            <Key size={16} className="text-primary" /> Authentication
          </h2>
          <p className="text-sm leading-7 text-muted">
            Any of these three work. The header is preferred; the body field is
            there for older scripts.
          </p>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border">
            {[
              { label: "Header (preferred)", value: "Authorization: Bearer pbk_..." },
              { label: "Header (alternative)", value: "X-API-Key: pbk_..." },
              { label: "Body field", value: "key=pbk_..." },
            ].map((row) => (
              <div
                key={row.label}
                className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3"
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-muted sm:w-44 shrink-0">
                  {row.label}
                </span>
                <code className="text-[11px] font-mono text-fg/90 break-all">
                  {row.value}
                </code>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-lg font-black text-fg">Endpoint</h2>
          <div className="rounded-2xl border border-border bg-card px-4 py-3">
            <code className="text-[12px] font-mono text-fg break-all">
              POST {ENDPOINT}
            </code>
          </div>
          <p className="text-sm leading-7 text-muted">
            Every call sends an <code className="text-fg font-mono text-[11px]">action</code>{" "}
            field. JSON and form-encoded bodies both work.
          </p>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-elevated/50">
                  <tr>
                    <th className="px-4 py-3 font-black uppercase tracking-widest text-[10px] text-muted">
                      action
                    </th>
                    <th className="px-4 py-3 font-black uppercase tracking-widest text-[10px] text-muted">
                      params
                    </th>
                    <th className="px-4 py-3 font-black uppercase tracking-widest text-[10px] text-muted">
                      returns
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ACTIONS.map((row) => (
                    <tr key={row.action}>
                      <td className="px-4 py-3 font-mono font-bold text-fg">
                        {row.action}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted">
                        {row.params}
                      </td>
                      <td className="px-4 py-3 text-muted">{row.returns}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-lg font-black text-fg">Examples</h2>
          <CodeBlock title="cURL" code={CURL_SAMPLE} />
          <CodeBlock title="JavaScript" code={JS_SAMPLE} />
          <CodeBlock title="PHP" code={PHP_SAMPLE} />
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-lg font-black text-fg">Status values</h2>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border">
            {[
              { value: "Pending", note: "Order created, not yet sent to the provider" },
              { value: "Processing", note: "Sent and running" },
              { value: "Completed", note: "Finished" },
              { value: "Partial", note: "Finished with fewer than ordered" },
              { value: "Canceled", note: "Stopped — the amount is refunded to your wallet" },
            ].map((row) => (
              <div key={row.value} className="flex flex-col sm:flex-row gap-1 sm:gap-4 px-4 py-3">
                <span className="text-xs font-bold text-fg sm:w-32 shrink-0">
                  {row.value}
                </span>
                <span className="text-xs text-muted">{row.note}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-lg font-black text-fg">Errors</h2>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-elevated/50">
                  <tr>
                    <th className="px-4 py-3 font-black uppercase tracking-widest text-[10px] text-muted">
                      code
                    </th>
                    <th className="px-4 py-3 font-black uppercase tracking-widest text-[10px] text-muted">
                      meaning
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["401", "Key missing, invalid or revoked"],
                    ["402", "Wallet balance too low — top up first"],
                    ["403", "Spend cap reached, or your IP is not allowed"],
                    ["404", "Order not found for this key"],
                    ["409", "Already refilled"],
                    ["429", "Too many requests — slow down"],
                  ].map(([code, meaning]) => (
                    <tr key={code}>
                      <td className="px-4 py-3 font-mono font-bold text-fg">{code}</td>
                      <td className="px-4 py-3 text-muted">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-lg font-black text-fg flex items-center gap-2">
            <Wallet size={16} className="text-primary" /> Good to know
          </h2>
          <ul className="space-y-3 text-sm leading-7 text-muted list-disc list-inside">
            <li>
              <strong className="text-fg">Prepaid.</strong> Orders are paid from
              your wallet instantly — there is no separate payment per order.
            </li>
            <li>
              <strong className="text-fg">A key only spends its own wallet.</strong>{" "}
              A leaked key cannot reach anyone else&apos;s balance.
            </li>
            <li>
              <strong className="text-fg">Retry safely.</strong> Send an{" "}
              <code className="text-fg font-mono text-[11px]">idempotency_key</code>{" "}
              with <code className="text-fg font-mono text-[11px]">add</code> and a
              repeated request returns the original order instead of charging twice.
            </li>
            <li>
              <strong className="text-fg">Prices are live.</strong> The catalog
              always reflects current rates.
            </li>
          </ul>
        </section>

        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
          <h2 className="text-sm font-black text-fg mb-2">Ready to build?</h2>
          <p className="text-xs text-muted mb-4">
            Create your key and place your first order in a couple of minutes.
          </p>
          <Link
            href="/app/api-access"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-background font-black text-xs uppercase tracking-wider"
          >
            <Key size={14} /> Get API Access
          </Link>
        </div>
      </div>
    </main>
  );
}
