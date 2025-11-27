import "./landing.css";
import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="landing-container">
      <header className="hero">
        <h1>Learn Armenian the Smart Way</h1>
        <p className="subtitle">
          A modern interactive platform that helps you master the Armenian
          language—from the alphabet to advanced grammar.
        </p>

        <div className="cta-buttons">
          <Link to="/signup" className="btn primary">
            Get Started
          </Link>
          <Link to="/login" className="btn secondary">
            Log In
          </Link>
        </div>
      </header>

      <section className="features">
        <h2>What’s Inside</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <h3>Step-by-Step Roadmap</h3>
            <p>
              Learn the Armenian alphabet, pronunciation, vocabulary, and
              grammar through a structured progression of lessons.
            </p>
          </div>

          <div className="feature-card">
            <h3>Gamified Learning</h3>
            <p>
              Earn XP, keep your daily streak, climb the leaderboard, and make
              progress enjoyable.
            </p>
          </div>

          <div className="feature-card">
            <h3>Mini-Exercises</h3>
            <p>
              Practice with short, engaging tasks: letter matching, word
              building, dictation, grammar challenges, and more.
            </p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>© 2025 Haylingua — Learn Armenian with confidence.</p>
      </footer>
    </div>
  );
}
