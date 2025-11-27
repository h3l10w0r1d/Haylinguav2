import "./landing.css";
import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="landing">

      {/* HERO SECTION */}
      <header className="hero fade-in">
        <h1 className="hero-title slide-up">Learn Armenian the Smart Way</h1>
        <p className="subtitle slide-up-delayed">
          An interactive platform that helps you master the Armenian alphabet,
          vocabulary, and grammar—from beginner to advanced.
        </p>

        <div className="cta-buttons slide-up-delayed-2">
          <Link to="/signup" className="btn primary">Get Started</Link>
          <Link to="/login" className="btn secondary">Log In</Link>
        </div>
      </header>

      {/* WHY ARMENIAN */}
      <section className="why fade-in">
        <h2>Why Learn Armenian?</h2>
        <p>
          Armenian is one of the world’s oldest languages with over 1,600 years
          of written history. From the unique alphabet created by Mesrop Mashtots
          to the rich cultural heritage, this language offers a beautiful and
          meaningful learning journey.
        </p>
      </section>

      {/* FEATURE GRID */}
      <section className="features fade-in">
        <h2>What You Get</h2>

        <div className="feature-grid">
          <div className="feature-card pop">
            <h3>Step-by-Step Roadmap</h3>
            <p>
              Master the alphabet, pronunciation, vocabulary, grammar, and sentence building—
              all in a structured curriculum.
            </p>
          </div>

          <div className="feature-card pop">
            <h3>Gamified Learning</h3>
            <p>
              Earn XP, maintain streaks, complete quests, unlock achievements, and
              climb the leaderboard.
            </p>
          </div>

          <div className="feature-card pop">
            <h3>Interactive Exercises</h3>
            <p>
              Practice with matching tasks, dictation, listening challenges,
              word-building, grammar games, and more.
            </p>
          </div>

          <div className="feature-card pop">
            <h3>Smart Progress Tracking</h3>
            <p>
              Visualize your skills, see daily improvements, and stay motivated
              with personalized reminders.
            </p>
          </div>
        </div>
      </section>

      {/* MINI ROADMAP */}
      <section className="roadmap fade-in">
        <h2>Your Learning Journey</h2>

        <div className="roadmap-steps">
          <div className="step slide-left">
            <span>1</span>
            Alphabet & Pronunciation
          </div>
          <div className="step slide-left-delayed">
            <span>2</span>
            Basic Words & Phrases
          </div>
          <div className="step slide-left-delayed-2">
            <span>3</span>
            Reading & Writing
          </div>
          <div className="step slide-left-delayed-3">
            <span>4</span>
            Intermediate Grammar
          </div>
          <div className="step slide-left-delayed-4">
            <span>5</span>
            Conversational Armenian
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="testimonials fade-in">
        <h2>What Learners Say</h2>

        <div className="testimonials-grid">
          <div className="testimonial pop">
            “I learned the alphabet in 3 days. The exercises are fun and addictive!”
          </div>
          <div className="testimonial pop">
            “This feels like a modern Duolingo but made for Armenian. Love it.”
          </div>
          <div className="testimonial pop">
            “The grammar explanations are clear and the progress tracking keeps me motivated.”
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="cta-final fade-in">
        <h2>Ready to Start Your Armenian Journey?</h2>
        <Link to="/signup" className="btn primary big">Join for Free</Link>
      </section>

      <footer className="footer fade-in">
        © {new Date().getFullYear()} Haylingua — Learn Armenian with confidence.
      </footer>
    </div>
  );
}
