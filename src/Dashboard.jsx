import { useEffect, useRef, useState } from "react";
import "./landing.css";

const API = import.meta.env.VITE_API_URL || "https://haylinguav2.onrender.com";

export default function Dashboard() {
  const [levels, setLevels] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadLevels() {
      try {
        const res = await fetch(`${API}/levels`);
        if (!res.ok) throw new Error("Failed to load levels");
        const data = await res.json();
        setLevels(data);
      } catch (err) {
        console.error(err);
        setError("Could not load levels from server.");
      } finally {
        setLoading(false);
      }
    }

    loadLevels();
  }, []);

  return (
    <div className="landing" style={{ minHeight: "100vh", paddingBottom: "3rem" }}>
      <header className="hero" style={{ padding: "2.5rem 1rem" }}>
        <h1>Your Armenian Roadmap</h1>
        <p className="subtitle">
          Progress through bite-sized pronunciation levels. Each level contains 5-7
          voice exercises. Finish a level to unlock the next.
        </p>
      </header>

      <section className="section">
        <h2>Levels</h2>

        {loading && <p>Loading levels…</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}

        <div className="grid">
          {levels.map((level) => (
            <div
              key={level.id}
              className="card"
              style={{ cursor: "pointer", border: "1px solid #ffd1a1" }}
              onClick={() => setSelectedLevel(level)}
            >
              <h3>{level.name}</h3>
              <p style={{ marginTop: "0.5rem" }}>{level.description}</p>
              <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", opacity: 0.7 }}>
                Exercises: {level.exercises.length}
              </p>
            </div>
          ))}
        </div>
      </section>

      {selectedLevel && (
        <section className="section" style={{ background: "#fff7ec" }}>
          <LevelPlayer level={selectedLevel} onClose={() => setSelectedLevel(null)} />
        </section>
      )}
    </div>
  );
}

function LevelPlayer({ level, onClose }) {
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [stars, setStars] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef(null);

  const exercise = level.exercises[index];

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  function getStarsDisplay(stars) {
    if (stars == null) return "";
    return "★".repeat(stars) + "☆".repeat(3 - stars);
  }

  async function handleFinishLevel(finalCorrect) {
    try {
      const res = await fetch(`${API}/levels/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level_id: level.id,
          total_exercises: level.exercises.length,
          correct: finalCorrect,
        }),
      });

      const data = await res.json();
      setStars(data.stars);
      setFeedback(data.message);
      setIsCompleted(true);
    } catch (err) {
      console.error(err);
      setFeedback("Finished, but failed to get score from server.");
      setIsCompleted(true);
    }
  }

  function startListening() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recog = new SpeechRecognition();
    recog.lang = "en-US"; // For now we expect Latin letters like "a"
    recog.interimResults = false;
    recog.maxAlternatives = 1;

    recog.onstart = () => setListening(true);

    recog.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      const expected = exercise.expected_answer.toLowerCase().trim();
      const isCorrect = transcript === expected || transcript.includes(expected);

      if (isCorrect) {
        setCorrectCount((c) => c + 1);
        setFeedback(`✅ Heard: "${transcript}" — Correct!`);
      } else {
        setFeedback(`❌ Heard: "${transcript}". Expected something like "${expected}".`);
      }

      moveNext(isCorrect);
    };

    recog.onerror = (event) => {
      console.error(event);
      setFeedback("Could not understand audio. Try again.");
      setListening(false);
    };

    recog.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recog;
    recog.start();
  }

  function moveNext() {
    const lastIndex = level.exercises.length - 1;
    if (index >= lastIndex) {
      // finished all exercises
      handleFinishLevel(correctCount + 0); // correctCount already updated via state
    } else {
      setIndex((i) => i + 1);
    }
  }

  function resetLevel() {
    setIndex(0);
    setCorrectCount(0);
    setStars(null);
    setIsCompleted(false);
    setFeedback("");
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
      <h2>{level.name}</h2>
      <p style={{ marginBottom: "1rem" }}>{level.description}</p>

      {!speechSupported && (
        <p style={{ color: "red" }}>
          Your browser doesn&apos;t support speech recognition (Web Speech API).
          Try latest Chrome on desktop.
        </p>
      )}

      {!isCompleted && (
        <>
          <p style={{ marginTop: "1rem" }}>Exercise {index + 1} of {level.exercises.length}</p>

          <div
            style={{
              fontSize: "4rem",
              margin: "1.5rem 0",
              fontWeight: "700",
            }}
          >
            {exercise.letter}
          </div>

          <p style={{ marginBottom: "1rem", opacity: 0.7 }}>
            Say it out loud in Latin: <strong>{exercise.expected_answer}</strong>
          </p>

          <button
            className="btn primary"
            type="button"
            onClick={startListening}
            disabled={listening || !speechSupported}
          >
            {listening ? "Listening…" : "Start speaking"}
          </button>

          {feedback && <p style={{ marginTop: "1rem" }}>{feedback}</p>}
        </>
      )}

      {isCompleted && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>Level complete!</h3>
          <p style={{ fontSize: "2rem", margin: "0.5rem 0" }}>
            {getStarsDisplay(stars)} ({stars} / 3 stars)
          </p>
          <p>{feedback}</p>

          <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", justifyContent: "center" }}>
            <button className="btn secondary" type="button" onClick={resetLevel}>
              Retry level
            </button>
            <button className="btn primary" type="button" onClick={onClose}>
              Back to roadmap
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
