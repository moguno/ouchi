import { OuchiPortal } from "./portal";

export default function App() {
  return (
    <main className="demo-page">
      <div className="demo-heading">
        <p className="demo-brand">ouchi.local / portal</p>
        <h1>
          <span>おうちのサービスを、</span>
          <span>ひと目で。</span>
        </h1>
        <p>
          ネットワークとデバイスを整理し、日々使うサービスへすぐ移動できるポータルです。
        </p>
      </div>
      <OuchiPortal />
      <p className="demo-note">
        Reactコンポーネント・デモ / データはブラウザ内に保存されます
      </p>
    </main>
  );
}
