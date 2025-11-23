import "./landing.css";

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
          <a href="/signup" className="btn primary">Get Started</a>
          <a href="/login" className="btn secondary">Log In</a>
        </div>
      </header>

      <section className="features">
        <h2>What’s Inside</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <h3>Step-by-Step Roadmap</h3>
            <p>
              Learn the Armenian alphabet, pronunciation, vocabulary, and grammar through a structured progression of lessons.
            </p>
          </div>

          <div className="feature-card">
            <h3>Gamified Learning</h3>
            <p>
              Earn XP, keep your daily streak, climb the leaderboard, and make progress enjoyable.
            </p>
          </div>

          <div className="feature-card">
            <h3>Interactive Exercises</h3>
            <p>
              Practice through multiple-choice, typing, pronunciation, and matching exercises designed for fast mastery.
            </p>
          </div>

          <div className="feature-card">
            <h3>Admin Panel & CMS</h3>
            <p>
              Manage lessons, track user statistics, and create new exercises from a dedicated control center—no coding required.
            </p>
          </div>
        </div>
      </section>

      <section className="info">
        <h2>Why Armenian?</h2>
        <p>
          Armenian is one of the world’s oldest languages, with a rich cultural
          heritage and a unique alphabet. Whether you're learning for heritage,
          travel, or curiosity, this platform guides you through every step.
        </p>
      </section>

      <footer className="footer">
        <p>© {new Date().getFullYear()} Armenian Learning Platform</p>
      </footer>
    </div>
  );
}
