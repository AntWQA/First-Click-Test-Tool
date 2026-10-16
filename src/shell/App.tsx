import { useState } from "react";
import { AppProvider, useApp } from "./state.tsx";
import { surfaceOf } from "./domain/session.ts";
import { Participant } from "./participant/Participant.tsx";
import { ModeratorShell } from "./moderator/Shell.tsx";
import type { Tab } from "./moderator/Shell.tsx";
import { Home } from "./moderator/Home.tsx";
import { Setup } from "./moderator/Setup.tsx";
import { Review } from "./moderator/Review.tsx";
import { Debrief } from "./moderator/Debrief.tsx";
import { Ledger } from "./moderator/Ledger.tsx";
import { ContentEditor } from "./moderator/ContentEditor.tsx";
import { Preview } from "./moderator/Preview.tsx";
import { useTheme } from "./theme.tsx";
import { Boundary } from "./Boundary.tsx";

/**
 * One state-driven app with two surfaces, moderator and participant, chosen by the session's phase. The surface lives in
 * session state, not in the address, so the participant cannot reach a moderator screen with the back button.
 */
function Root() {
  const { active, closeSession, sessions } = useApp();
  const [tab, setTab] = useState<Tab>("sessions");
  // A run opened for findings, from the Ledger or a session record. Closing it returns to wherever it was opened from.
  const [reviewing, setReviewing] = useState<{ sessionId: string; runId: string } | null>(null);
  const reviewSession = reviewing ? sessions.find((s) => s.id === reviewing.sessionId) : undefined;
  const [theme, toggleTheme] = useTheme();
  if (active && surfaceOf(active.phase) === "participant") return <Participant session={active} theme={theme} onToggleTheme={toggleTheme} />;
  const wide = reviewing !== null || (active ? false : tab === "ledger" || tab === "content" || tab === "preview");
  const openReview = (sessionId: string, runId: string) => setReviewing({ sessionId, runId });
  return (
    <ModeratorShell tab={tab} onTab={setTab} inSession={active !== null || reviewing !== null} wide={wide} theme={theme} onToggleTheme={toggleTheme}>
      {reviewing ? (
        reviewSession
          ? <Review session={reviewSession} runId={reviewing.runId} onBack={() => setReviewing(null)} backLabel={active ? "Back to the session record" : "Back to the Ledger"} />
          : <main className="m-page"><h1>That session is no longer saved</h1><p><button type="button" className="btn btn-primary" onClick={() => setReviewing(null)}>Back</button></p></main>
      ) : active ? (
        <>
          <div className="m-sessionbar"><button type="button" className="btn btn-quiet" onClick={closeSession}>All sessions</button></div>
          {active.phase === "setup" && <Setup session={active} />}
          {(active.phase === "debrief" || active.phase === "ended") && <Debrief session={active} onReview={openReview} />}
        </>
      ) : tab === "sessions" ? <Home /> : tab === "ledger" ? <Ledger onReview={openReview} /> : tab === "content" ? <ContentEditor /> : <Preview />}
    </ModeratorShell>
  );
}

export function App() {
  return <Boundary><AppProvider><Root /></AppProvider></Boundary>;
}
