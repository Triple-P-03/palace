"use client";

import { useEffect, useMemo, useState } from "react";
import { compareRecall } from "@/lib/recall";
import type { Lesson, RecallResult, Topic } from "@/lib/types";

const defaultTopics: Topic[] = [
  { id: "astronomy", name: "Astronomy & space", enabled: true },
  { id: "ancient-egypt", name: "Ancient Egypt", enabled: true },
  { id: "world-history", name: "World history", enabled: true },
  { id: "biology", name: "Biology", enabled: false },
];

const defaultRoute = ["Entrance", "Threshold", "Doorway", "Desk / table", "Window"];

type View = "home" | "topics" | "library";

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [topics, setTopics] = useState<Topic[]>(defaultTopics);
  const [route, setRoute] = useState(defaultRoute);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [recallText, setRecallText] = useState("");
  const [recallResult, setRecallResult] = useState<RecallResult | null>(null);

  useEffect(() => {
    const savedTopics = window.localStorage.getItem("palace-topics");
    const savedRoute = window.localStorage.getItem("palace-route");
    const savedLessons = window.localStorage.getItem("palace-lessons");
    window.setTimeout(() => {
      if (savedTopics) setTopics(JSON.parse(savedTopics));
      if (savedRoute) setRoute(JSON.parse(savedRoute));
      if (savedLessons) {
        const parsedLessons = JSON.parse(savedLessons) as Lesson[];
        setLessons(parsedLessons);
        setActiveLesson(parsedLessons[0] ?? null);
      }
    }, 0);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromDatabase() {
      try {
        const [topicsResponse, lessonsResponse] = await Promise.all([
          fetch("/api/topics"),
          fetch("/api/lessons"),
        ]);
        const remoteTopics = (await topicsResponse.json()).topics as Topic[];
        const remoteLessons = (await lessonsResponse.json()).lessons as Lesson[];
        if (cancelled) return;
        if (remoteTopics.length > 0) setTopics(remoteTopics);
        if (remoteLessons.length > 0) {
          setLessons(remoteLessons);
          setActiveLesson(remoteLessons[0] ?? null);
        }
      } catch {
        // Local storage remains the offline-friendly fallback.
      }
    }

    void hydrateFromDatabase();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem("palace-topics", JSON.stringify(topics));
    void Promise.all(topics.map((topic) => fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(topic),
    }))).catch(() => undefined);
  }, [topics]);

  useEffect(() => {
    window.localStorage.setItem("palace-route", JSON.stringify(route));
  }, [route]);

  useEffect(() => {
    window.localStorage.setItem("palace-lessons", JSON.stringify(lessons));
  }, [lessons]);

  const enabledTopics = useMemo(() => topics.filter((topic) => topic.enabled), [topics]);
  const recentTopic = activeLesson?.topic;

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4000);
  }

  async function generateTask() {
    if (enabledTopics.length === 0) {
      setView("topics");
      showNotice("Enable at least one topic before asking for a task.");
      return;
    }

    const candidates = enabledTopics.filter((topic) => topic.name !== recentTopic);
    const selected = (candidates.length ? candidates : enabledTopics)[lessons.length % (candidates.length || enabledTopics.length)];
    setLoading(true);
    setRecallText("");
    setRecallResult(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: selected.name, routeLocations: route }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Generation failed");
      const lesson = data.lesson as Lesson;
      setLessons((previous) => [lesson, ...previous.filter((item) => item.id !== lesson.id)]);
      setActiveLesson(lesson);
      setView("home");
      showNotice(data.demo ? "Demo lesson ready. Add your Gemini key for fresh lessons." : "A fresh task has been prepared.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not create a lesson.");
    } finally {
      setLoading(false);
    }
  }

  function toggleTopic(id: string) {
    setTopics((previous) => previous.map((topic) => topic.id === id ? { ...topic, enabled: !topic.enabled } : topic));
  }

  function addTopic(event: React.FormEvent) {
    event.preventDefault();
    const name = newTopic.trim();
    if (!name) return;
    if (topics.some((topic) => topic.name.toLowerCase() === name.toLowerCase())) {
      showNotice("That topic is already on your list.");
      return;
    }
    setTopics((previous) => [...previous, { id: crypto.randomUUID(), name, enabled: true }]);
    setNewTopic("");
  }

  function updateRoute(index: number, value: string) {
    setRoute((previous) => previous.map((stop, stopIndex) => stopIndex === index ? value : stop));
  }

  function checkRecall() {
    if (!activeLesson) return;
    setRecallResult(compareRecall(activeLesson.paragraph, recallText));
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><span>✦</span></div>
          <div><strong>PALACE</strong><small>MEMORY STUDIO</small></div>
        </div>

        <div className="sidebar-label">Workspace</div>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={view === "home" ? "nav-item active" : "nav-item"} onClick={() => setView("home")}><Icon>⌂</Icon> Today&apos;s practice</button>
          <button className={view === "topics" ? "nav-item active" : "nav-item"} onClick={() => setView("topics")}><Icon>◉</Icon> My topics <span className="nav-count">{enabledTopics.length}</span></button>
          <button className={view === "library" ? "nav-item active" : "nav-item"} onClick={() => setView("library")}><Icon>▤</Icon> Lesson library <span className="nav-count">{lessons.length}</span></button>
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-card">
          <div className="sidebar-card-icon">♧</div>
          <strong>Build your route</strong>
          <p>Use the places you know best. Familiarity makes the images stick.</p>
          <button onClick={() => setView("topics")}>Edit palace <span>→</span></button>
        </div>
        <div className="profile-row"><div className="avatar">Y</div><div><strong>Your studio</strong><small>Private workspace</small></div><span className="more">•••</span></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{view === "home" ? "Today's practice" : view === "topics" ? "My topics" : "Lesson library"}</strong></div>
          <div className="top-actions"><span className="streak"><span>✹</span> 4 day streak</span><button className="help-button" aria-label="Help">?</button></div>
        </header>

        {notice && <div className="notice" role="status"><span>✦</span>{notice}<button onClick={() => setNotice("")}>×</button></div>}

        {view === "topics" && (
          <TopicsView topics={topics} toggleTopic={toggleTopic} newTopic={newTopic} setNewTopic={setNewTopic} addTopic={addTopic} route={route} updateRoute={updateRoute} />
        )}

        {view === "library" && (
          <LibraryView lessons={lessons} onSelect={(lesson) => { setActiveLesson(lesson); setView("home"); setRecallResult(null); setRecallText(""); }} />
        )}

        {view === "home" && (
          <>
            <section className="hero-row">
              <div>
                <p className="eyebrow">SUNDAY, OCTOBER 25 <span>·</span> SESSION 05</p>
                <h1>Train your mind,<br /><em>one place at a time.</em></h1>
                <p className="hero-copy">Your next memory palace task is waiting. Learn a vivid paragraph, place it on your route, then recall it word for word.</p>
              </div>
              <div className="hero-orbit" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-dot dot-one" /><div className="orbit-dot dot-two" /><div className="orbit-core">✦</div></div>
            </section>

            <section className="task-card">
              <div className="task-card-top"><div className="topic-pip">✦</div><div><span className="card-kicker">NEXT UP</span><h2>Generate a memorization task</h2></div><span className="ai-badge">GEMINI READY</span></div>
              <div className="task-card-body"><p>We&apos;ll choose from your enabled topics and create a focused, fact-rich paragraph with a five-stop visual route.</p><div className="selected-topics">{enabledTopics.slice(0, 4).map((topic) => <span key={topic.id} className="topic-chip">{topic.name}</span>)}{enabledTopics.length > 4 && <span className="topic-chip muted">+{enabledTopics.length - 4}</span>}</div></div>
              <div className="task-card-footer"><span className="route-note"><span>⌘</span> {route.length} stops on your route</span><button className="primary-button" onClick={generateTask} disabled={loading}>{loading ? <><span className="spinner" /> Building your palace...</> : <>Give me a task <span>↗</span></>}</button></div>
            </section>

            {activeLesson ? <LessonView lesson={activeLesson} recallText={recallText} setRecallText={setRecallText} recallResult={recallResult} checkRecall={checkRecall} /> : <EmptyState onGenerate={generateTask} />}
          </>
        )}
      </main>
    </div>
  );
}

function TopicsView({ topics, toggleTopic, newTopic, setNewTopic, addTopic, route, updateRoute }: { topics: Topic[]; toggleTopic: (id: string) => void; newTopic: string; setNewTopic: (value: string) => void; addTopic: (event: React.FormEvent) => void; route: string[]; updateRoute: (index: number, value: string) => void }) {
  return <div className="page-view"><div className="page-heading"><div><p className="eyebrow">YOUR LEARNING SIGNALS</p><h1>Topics &amp; route</h1><p>Tell Palace what you&apos;re curious about. It will turn these interests into your next assignment.</p></div><div className="heading-stamp">✦ <span>Curiosity<br />is a practice</span></div></div>
    <div className="settings-grid"><section className="panel"><div className="panel-heading"><div><span className="card-kicker">TOPIC ROTATION</span><h2>What should we teach you?</h2></div><span className="panel-count">{topics.filter((topic) => topic.enabled).length} active</span></div><div className="topic-list">{topics.map((topic) => <div className="topic-row" key={topic.id}><div className={topic.enabled ? "topic-icon on" : "topic-icon"}>✦</div><span>{topic.name}</span><button className={topic.enabled ? "toggle on" : "toggle"} onClick={() => toggleTopic(topic.id)} aria-label={`${topic.enabled ? "Pause" : "Enable"} ${topic.name}`}><span /></button></div>)}</div><form className="add-topic" onSubmit={addTopic}><input value={newTopic} onChange={(event) => setNewTopic(event.target.value)} placeholder="Add a topic you love..." /><button type="submit">Add topic <span>+</span></button></form></section>
      <section className="panel route-panel"><div className="panel-heading"><div><span className="card-kicker">YOUR MEMORY PALACE</span><h2>Five-stop route</h2></div><span className="route-icon">⌂</span></div><p className="panel-intro">Use a familiar place. Edit the labels to match how you walk through it.</p><div className="route-list">{route.map((stop, index) => <div className="route-row" key={`${index}-${stop}`}><span className="route-number">0{index + 1}</span><input value={stop} onChange={(event) => updateRoute(index, event.target.value)} /><span className="route-line" /></div>)}</div><p className="route-footnote">The AI will use these exact locations when it creates each visual scene.</p></section></div>
  </div>;
}

function LibraryView({ lessons, onSelect }: { lessons: Lesson[]; onSelect: (lesson: Lesson) => void }) {
  return <div className="page-view"><div className="page-heading"><div><p className="eyebrow">YOUR MEMORY ARCHIVE</p><h1>Lesson library</h1><p>Every paragraph you&apos;ve placed, ready to walk again.</p></div><div className="library-total"><strong>{lessons.length.toString().padStart(2, "0")}</strong><span>lessons<br />stored</span></div></div>{lessons.length === 0 ? <div className="empty-library"><div>✦</div><h2>Your archive is quiet.</h2><p>Generate your first task and it will live here.</p></div> : <div className="library-grid">{lessons.map((lesson, index) => <button className="library-card" key={lesson.id} onClick={() => onSelect(lesson)}><div className="library-card-top"><span className="library-index">{String(index + 1).padStart(2, "0")}</span><span className="library-topic">{lesson.topic}</span></div><h2>{lesson.title}</h2><p>{lesson.paragraph}</p><div className="library-card-bottom"><span>{lesson.chunks.length} palace stops</span><span>{new Date(lesson.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} ↗</span></div></button>)}</div>}</div>;
}

function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  return <section className="empty-state"><div className="empty-icon">✦</div><p className="card-kicker">YOUR FIRST WALK</p><h2>No active lesson yet.</h2><p>Generate a task above to receive a paragraph, five memory scenes, and an exact-recall drill.</p><button className="text-button" onClick={onGenerate}>Start my first walk <span>→</span></button></section>;
}

function LessonView({ lesson, recallText, setRecallText, recallResult, checkRecall }: { lesson: Lesson; recallText: string; setRecallText: (value: string) => void; recallResult: RecallResult | null; checkRecall: () => void }) {
  const [tab, setTab] = useState<"map" | "prompt" | "recall">("map");
  return <section className="lesson-section"><div className="lesson-header"><div><div className="lesson-meta"><span className="lesson-topic">{lesson.topic}</span><span>·</span><span>5 stops</span><span>·</span><span>{lesson.demo ? "Demo lesson" : "Gemini lesson"}</span></div><h2>{lesson.title}</h2></div><span className="saved-label">✓ Saved to library</span></div><div className="lesson-tabs"><button className={tab === "map" ? "lesson-tab active" : "lesson-tab"} onClick={() => setTab("map")}>01 <span>Route map</span></button><button className={tab === "prompt" ? "lesson-tab active" : "lesson-tab"} onClick={() => setTab("prompt")}>02 <span>Prompt sheet</span></button><button className={tab === "recall" ? "lesson-tab active" : "lesson-tab"} onClick={() => setTab("recall")}>03 <span>Exact recall</span></button></div>{tab === "map" && <RouteMap lesson={lesson} />}{tab === "prompt" && <PromptSheet lesson={lesson} />}{tab === "recall" && <RecallPractice recallText={recallText} setRecallText={setRecallText} recallResult={recallResult} checkRecall={checkRecall} />}</section>;
}

function RouteMap({ lesson }: { lesson: Lesson }) {
  return <div className="lesson-body"><div className="paragraph-card"><div className="section-label"><span>THE PARAGRAPH</span><span className="word-count">{lesson.paragraph.split(/\s+/).length} words</span></div><p>{lesson.paragraph}</p><div className="paragraph-rule" /><p className="reading-note">Read it slowly twice. Notice the rhythm before you place each scene.</p></div><div className="map-heading"><div><span className="card-kicker">CHUNKING &amp; VISUAL PALACE ROUTE</span><h3>Walk the story through your space.</h3></div><span className="map-key">ANCHOR → SCENE</span></div><div className="chunk-list">{lesson.chunks.map((chunk, index) => <article className="chunk-card" key={chunk.id}><div className="chunk-index"><span>0{index + 1}</span><i /></div><div className="chunk-content"><div className="chunk-top"><span className="stop-name">{chunk.stop}</span><span className="chunk-tag">CHUNK {index + 1}</span></div><p className="chunk-text">{chunk.exactText}</p><div className="chunk-details"><div><span className="detail-label">ANCHOR WORDS</span><div className="anchor-list">{chunk.anchorWords.map((word) => <span key={word}>{word}</span>)}</div></div><div className="scene"><span className="detail-label">VISUAL MEMORY SCENE</span><p>{chunk.visualScene}</p></div></div></div></article>)}</div></div>;
}

function PromptSheet({ lesson }: { lesson: Lesson }) {
  return <div className="prompt-sheet"><div className="prompt-intro"><span className="prompt-symbol">Aa</span><div><span className="card-kicker">FIRST-LETTER PROMPTING SHEET</span><h3>Let the first letters pull the words back.</h3><p>Hide the original paragraph. Use these cues to rehearse the exact sentence structure, then test yourself in the recall tab.</p></div></div><div className="full-prompt"><div className="section-label"><span>FULL PARAGRAPH PROMPT</span><span className="word-count">Exact order</span></div><p>{lesson.firstLetterPrompt}</p></div><div className="prompt-chunks">{lesson.chunks.map((chunk, index) => <div className="prompt-chunk" key={chunk.id}><span>0{index + 1} · {chunk.stop}</span><p>{chunk.firstLetterPrompt}</p></div>)}</div><div className="prompt-tip"><span>✦</span><p><strong>Practice tip:</strong> Say the paragraph out loud while looking only at the prompt. Pause at each stop and let your visual scene supply the next phrase.</p></div></div>;
}

function RecallPractice({ recallText, setRecallText, recallResult, checkRecall }: { recallText: string; setRecallText: (value: string) => void; recallResult: RecallResult | null; checkRecall: () => void }) {
  return <div className="recall-panel"><div className="recall-intro"><div className="recall-number">03</div><div><span className="card-kicker">THE WALK BACK</span><h3>Reconstruct the paragraph.</h3><p>Move through your five stops in order. Type exactly what you remember—words, numbers, and punctuation all count.</p></div></div><textarea className="recall-input" value={recallText} onChange={(event) => setRecallText(event.target.value)} placeholder="Begin at the entrance..." spellCheck={false} /><div className="recall-actions"><span>{recallText.trim() ? `${recallText.trim().split(/\s+/).length} words entered` : "Nothing entered yet"}</span><button className="primary-button" onClick={checkRecall} disabled={!recallText.trim()}>Check my recall <span>↗</span></button></div>{recallResult && <div className={recallResult.exact ? "result-card perfect" : "result-card"}><div className="result-score"><strong>{recallResult.score}%</strong><span>{recallResult.exact ? "Perfect recall" : "Word order match"}</span></div><div className="result-copy"><h4>{recallResult.exact ? "You walked the whole route." : "Your route is taking shape."}</h4><p>{recallResult.exact ? "Every word and space is in place. That paragraph is yours." : `${recallResult.matchedWords} of ${recallResult.expectedWords} words matched their exact positions. Keep using your scenes, then try again.`}</p>{recallResult.differences.length > 0 && <div className="difference-list"><span>First places to revisit:</span>{recallResult.differences.slice(0, 3).map((difference) => <em key={difference.index}>{difference.expected || "missing"}</em>)}</div>}</div></div>}</div>;
}
