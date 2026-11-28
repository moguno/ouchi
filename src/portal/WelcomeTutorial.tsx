import { useState } from "react";
import "./styles/welcome-tutorial.css";

/**
 * The getting-started panel shown while the active project has no
 * networks yet (mock29, user-approved 2026-11-28). Like GitLab's /
 * GitHub's empty-project pages it offers two ways in: draw it
 * yourself starting from a network, or connect an AI agent over
 * MCP and let it draw. The MCP settings are always visible — no
 * toggle — and the URL is built from the host the portal itself
 * was opened on, since the MCP server lives on the same machine.
 */
export function WelcomeTutorial({
  onAddNetwork,
}: {
  onAddNetwork: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const mcpUrl =
    typeof window !== "undefined"
      ? `http://${window.location.hostname}:3333/mcp`
      : "http://localhost:3333/mcp";
  const mcpConfig = JSON.stringify(
    { mcpServers: { ouchi: { url: mcpUrl } } },
    null,
    2,
  );

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context, permissions): the
      // URL stays on screen to be copied by hand.
    }
  }

  return (
    <div className="ouchi-welcome">
      <h2 className="ouchi-welcome-heading">さぁ、はじめよう！</h2>
      <p className="ouchi-welcome-sub">
        ここにあなたのホームラボを描いていきましょう。
      </p>
      <div className="ouchi-welcome-stack">
        <section className="ouchi-welcome-card">
          <h3>自分で描く</h3>
          <p>まずはネットワークを作りましょう。</p>
          <button
            className="ouchi-welcome-add"
            onClick={onAddNetwork}
            type="button"
          >
            ネットワークを追加
          </button>
          <p className="ouchi-welcome-after">
            ネットワークが出来たら、そこにデバイスやサービスを配置しましょう。
          </p>
        </section>
        <section className="ouchi-welcome-card">
          <h3>AIに描いてもらう</h3>
          <p>
            AIエージェントを MCP
            で接続すると、会話するだけでネットワークやデバイスを台帳に描いてくれます。下の設定をお使いの
            AI エージェントに貼り付けてください。
          </p>
          <div className="ouchi-welcome-mcp">
            <p className="ouchi-welcome-mcp-label">MCP サーバー URL</p>
            <div className="ouchi-welcome-url">
              <span>{mcpUrl}</span>
              <button onClick={() => void copyUrl()} type="button">
                {copied ? "コピーしました" : "コピー"}
              </button>
            </div>
            <pre className="ouchi-welcome-config">{mcpConfig}</pre>
            <p className="ouchi-welcome-hint">
              接続できたら「この家のネットワークを描いて」と頼むだけです。
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
