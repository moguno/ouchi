import { OuchiPortal } from "./portal";

export default function App() {
  const yamlDemo = import.meta.env.VITE_PORTAL_DATA_SOURCE === "yaml";
  const yamlUrl =
    import.meta.env.VITE_SAMPLE_LEDGER_URL || "ouchi-ledger.sample.yaml";

  return (
    <main className="demo-page">
      <header className="demo-portal-title">
        <div className="ouchi-title-block">
          <span className="ouchi-home-mark" aria-hidden="true">
            家
          </span>
          <div>
            <h1>ouchi.local</h1>
            <p className="ouchi-summary demo-portal-subtitle">
              AIと創る、おうちネットワーク
            </p>
            {yamlDemo && (
              <span className="demo-mode-badge">
                架空サンプルデータ / 読み取り専用
              </span>
            )}
          </div>
        </div>
      </header>
      <OuchiPortal
        readOnly={yamlDemo}
        showTitle={false}
        yamlUrl={yamlDemo ? yamlUrl : undefined}
      />
      <p className="demo-note">
        {yamlDemo
          ? "架空のサンプルデータを使用したGitHub Pages向け表示専用デモです。編集・保存はできません。"
          : "Reactコンポーネント・デモ / SQLite台帳をHono API経由で表示します"}
      </p>
    </main>
  );
}
