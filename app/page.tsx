import { ChatPanel } from "../components/layout/ChatPanel";
import { CodePanel } from "../components/layout/CodePanel";
import { PreviewPanel } from "../components/layout/PreviewPanel";

export default function Home() {
  return (
    <main>
      <div className="app-shell">
        <ChatPanel />
        <div className="app-right">
          <CodePanel />
          <PreviewPanel />
        </div>
      </div>
    </main>
  );
}
