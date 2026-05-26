"use client";
import { useState } from "react";

const T = {
  bg:       "#0A0A0F",
  surface:  "#12121A",
  border:   "#1E1E2E",
  borderHi: "#2D2D4E",
  purple:   "#C084FC",
  purpleDim:"#7C3AED",
  pink:     "#F472B6",
  green:    "#34D399",
  orange:   "#FB923C",
  blue:     "#60A5FA",
  text:     "#F1F5F9",
  muted:    "#64748B",
  red:      "#F87171",
};

type OSINTType = "ip" | "phone" | "domain" | "company" | "username";

const TYPE_CONFIG: Record<OSINTType, { icon: string; placeholder: string; hint: string }> = {
  ip:       { icon: "◈", placeholder: "8.8.8.8",           hint: "Public IPv4 only" },
  phone:    { icon: "◉", placeholder: "+919876543210",      hint: "E.164 format with country code" },
  domain:   { icon: "◎", placeholder: "example.com",        hint: "Domain without https://" },
  company:  { icon: "◆", placeholder: "Sun Pharma",         hint: "Company name for NSE/news intel" },
  username: { icon: "◇", placeholder: "jogendra20",         hint: "Username to check across platforms" },
};

const LEGAL_COLORS: Record<string, string> = {
  ip:       T.blue,
  phone:    T.green,
  domain:   T.purple,
  company:  T.orange,
  username: T.pink,
};

function ResultCard({ data, type }: { data: any; type: OSINTType }) {
  if (data.legal_block) {
    return (
      <div style={{ padding: "12px 14px", background: "rgba(248,113,113,0.08)",
        border: `1px solid rgba(248,113,113,0.3)`, borderRadius: 10, marginTop: 12 }}>
        <div style={{ fontSize: 10, color: T.red, letterSpacing: "1px",
          fontFamily: "JetBrains Mono, monospace", marginBottom: 6 }}>⛔ BLOCKED — LEGAL GUARDRAIL</div>
        <div style={{ fontSize: 12, color: "#CBD5E1" }}>{data.error}</div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div style={{ padding: "12px 14px", background: T.surface,
        border: `1px solid ${T.border}`, borderRadius: 10, marginTop: 12 }}>
        <div style={{ fontSize: 11, color: T.red }}>Error: {data.error}</div>
      </div>
    );
  }

  const color = LEGAL_COLORS[type];

  // Fields to render per type
  const fields: [string, any][] = Object.entries(data).filter(([k]) =>
    !["query_type","query","cached","legal_note","source","arjun_note"].includes(k)
  );

  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 9, color, letterSpacing: "2px",
          fontFamily: "JetBrains Mono, monospace" }}>
          {type.toUpperCase()} INTELLIGENCE
        </div>
        <div style={{ fontSize: 9, color: T.muted, fontFamily: "JetBrains Mono, monospace" }}>
          {data.cached ? "⚡ CACHED" : "🔍 LIVE"}
        </div>
      </div>

      {/* Main result card */}
      <div style={{ padding: "12px 14px", background: T.surface,
        border: `1px solid ${T.border}`, borderRadius: 10,
        display: "flex", flexDirection: "column", gap: 8 }}>
        {fields.map(([key, val]) => {
          if (val === null || val === undefined) return null;

          // Arrays
          if (Array.isArray(val)) {
            if (val.length === 0) return null;
            return (
              <div key={key}>
                <div style={{ fontSize: 9, color: T.muted, letterSpacing: "1px",
                  fontFamily: "JetBrains Mono, monospace", marginBottom: 4 }}>
                  {key.toUpperCase().replace(/_/g, " ")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {val.slice(0, 8).map((item: any, i: number) => (
                    <div key={i} style={{ fontSize: 11, color: "#CBD5E1",
                      padding: "3px 8px", background: "#0D1117",
                      borderRadius: 5, fontFamily: "JetBrains Mono, monospace" }}>
                      {typeof item === "object" ? (
                        <span>
                          {item.platform && <span style={{ color }}>{item.platform} </span>}
                          {item.url && <span style={{ color: T.muted }}>{item.url}</span>}
                        </span>
                      ) : String(item)}
                    </div>
                  ))}
                  {val.length > 8 && (
                    <div style={{ fontSize: 10, color: T.muted }}>+{val.length - 8} more</div>
                  )}
                </div>
              </div>
            );
          }

          // Objects
          if (typeof val === "object") {
            const entries = Object.entries(val).filter(([,v]) => v);
            if (entries.length === 0) return null;
            return (
              <div key={key}>
                <div style={{ fontSize: 9, color: T.muted, letterSpacing: "1px",
                  fontFamily: "JetBrains Mono, monospace", marginBottom: 4 }}>
                  {key.toUpperCase().replace(/_/g, " ")}
                </div>
                {entries.map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 8, fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: T.muted, minWidth: 100,
                      fontFamily: "JetBrains Mono, monospace" }}>{k}</span>
                    <span style={{ color: "#CBD5E1" }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            );
          }

          // Booleans
          if (typeof val === "boolean") {
            return (
              <div key={key} style={{ display: "flex", gap: 8, fontSize: 11, alignItems: "center" }}>
                <span style={{ color: T.muted, minWidth: 120,
                  fontFamily: "JetBrains Mono, monospace", fontSize: 9,
                  letterSpacing: "1px" }}>{key.toUpperCase().replace(/_/g, " ")}</span>
                <span style={{ color: val ? T.green : T.red }}>{val ? "YES" : "NO"}</span>
              </div>
            );
          }

          // Primitives
          return (
            <div key={key} style={{ display: "flex", gap: 8, fontSize: 11, alignItems: "flex-start" }}>
              <span style={{ color: T.muted, minWidth: 120, flexShrink: 0,
                fontFamily: "JetBrains Mono, monospace", fontSize: 9,
                letterSpacing: "1px", paddingTop: 1 }}>{key.toUpperCase().replace(/_/g, " ")}</span>
              <span style={{ color: "#CBD5E1", wordBreak: "break-all" }}>{String(val)}</span>
            </div>
          );
        })}
      </div>

      {/* Legal note */}
      {data.legal_note && (
        <div style={{ padding: "8px 12px", background: "rgba(52,211,153,0.06)",
          border: "1px solid rgba(52,211,153,0.15)", borderRadius: 8,
          fontSize: 10, color: T.green, lineHeight: 1.5 }}>
          ⚖ {data.legal_note}
        </div>
      )}

      {/* Source */}
      {data.source && (
        <div style={{ fontSize: 9, color: T.muted,
          fontFamily: "JetBrains Mono, monospace" }}>
          SOURCE · {data.source.toUpperCase()}
        </div>
      )}

      {/* ARJUN note */}
      {data.arjun_note && (
        <div style={{ padding: "8px 12px", background: "rgba(96,165,250,0.06)",
          border: "1px solid rgba(96,165,250,0.15)", borderRadius: 8,
          fontSize: 10, color: T.blue, lineHeight: 1.5 }}>
          ⚡ ARJUN · {data.arjun_note}
        </div>
      )}
    </div>
  );
}

export default function OSINTPanel() {
  const [type, setType] = useState<OSINTType>("ip");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const config = TYPE_CONFIG[type];

  const run = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/osint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, query: query.trim() }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setResult({ error: e?.message ?? "Request failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px",
      display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 9, color: T.muted, letterSpacing: "2px",
          fontFamily: "JetBrains Mono, monospace", marginBottom: 4 }}>
          OSINT INTELLIGENCE
        </div>
        <div style={{ fontSize: 10, color: T.muted, lineHeight: 1.5 }}>
          Public data only · Legal guardrails active · Audit logged
        </div>
      </div>

      {/* Type selector */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {(Object.keys(TYPE_CONFIG) as OSINTType[]).map(t => (
          <button key={t} onClick={() => { setType(t); setQuery(""); setResult(null); }}
            style={{
              padding: "4px 12px", borderRadius: 6, border: "none",
              cursor: "pointer", fontSize: 9, letterSpacing: "1px",
              fontFamily: "JetBrains Mono, monospace",
              background: type === t ? `${LEGAL_COLORS[t]}18` : "transparent",
              color: type === t ? LEGAL_COLORS[t] : T.muted,
              borderBottom: type === t ? `1px solid ${LEGAL_COLORS[t]}` : "1px solid transparent",
              transition: "all 0.15s",
            }}>
            {TYPE_CONFIG[t].icon} {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center",
          background: T.surface, border: `1px solid ${T.borderHi}`,
          borderRadius: 10, padding: "8px 12px" }}>
          <span style={{ color: LEGAL_COLORS[type], fontSize: 14,
            fontFamily: "JetBrains Mono, monospace", flexShrink: 0 }}>
            {config.icon}
          </span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") run(); }}
            placeholder={config.placeholder}
            style={{ flex: 1, background: "transparent", border: "none",
              outline: "none", color: T.text, fontSize: 13,
              fontFamily: "JetBrains Mono, monospace" }}
          />
          <button onClick={run} disabled={!query.trim() || loading}
            style={{ padding: "4px 14px", borderRadius: 6, border: "none",
              cursor: query.trim() && !loading ? "pointer" : "default",
              fontSize: 10, letterSpacing: "1px",
              fontFamily: "JetBrains Mono, monospace",
              background: query.trim() && !loading
                ? `linear-gradient(135deg, ${LEGAL_COLORS[type]}, ${T.purpleDim})`
                : T.border,
              color: query.trim() && !loading ? T.text : T.muted,
              transition: "all 0.2s",
            }}>
            {loading ? "SCANNING..." : "RUN →"}
          </button>
        </div>
        <div style={{ fontSize: 9, color: T.muted,
          fontFamily: "JetBrains Mono, monospace", paddingLeft: 4 }}>
          ⚖ {config.hint}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "8px 0" }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 5, height: 5, borderRadius: "50%",
              background: LEGAL_COLORS[type],
              animation: `pulse 1.2s ease ${i*0.2}s infinite` }} />
          ))}
          <span style={{ fontSize: 10, color: T.muted, marginLeft: 4,
            fontFamily: "JetBrains Mono, monospace" }}>
            QUERYING PUBLIC SOURCES...
          </span>
        </div>
      )}

      {/* Result */}
      {result && <ResultCard data={result} type={type} />}
    </div>
  );
}
