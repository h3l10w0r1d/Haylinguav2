// src/LandingPage.jsx
import { useState } from "react";
import {
  Globe,
  Trophy,
  Users,
  Zap,
  Star,
  Heart,
  Award,
  BookOpen,
} from "lucide-react";
import LoginModal from "./LoginModal";

// update these paths to match your actual image filenames
import characterTeacher from "./assets/character-teacher.png";
import characterGrandma from "./assets/character-grandma.png";
import characterStudent from "./assets/character-student.png";

export default function LandingPage({ onLogin, onSignup }) {
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("login"); // 'login' | 'signup'

  const openModal = (mode) => {
    setModalMode(mode);
    setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-orange-600 text-white p-2 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="text-orange-600 font-semibold text-lg">
              Haylingua
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => openModal("login")}
              className="px-6 py-2 border-2 border-orange-600 text-orange-600 rounded-xl hover:bg-orange-50 transition-colors"
            >
              Login
            </button>
            <button
              onClick={() => openModal("signup")}
              className="px-6 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl font-semibold text-gray-900 mb-6">
              Learn Armenian the fun way!
            </h1>
            <p className="text-gray-600 mb-8 text-lg">
              Master the Armenian language through interactive lessons,
              engaging exercises, and gamified learning. Join thousands of
              learners on their journey to fluency.
            </p>
            <button
              onClick={() => openModal("signup")}
              className="px-8 py-4 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors shadow-lg"
            >
              Start Learning Free
            </button>
            <div className="mt-8 flex gap-8">
              <div>
                <div className="text-orange-600 font-semibold text-xl">
                  10K+
                </div>
                <div className="text-gray-600 text-sm">Active Learners</div>
              </div>
              <div>
                <div className="text-orange-600 font-semibold text-xl">
                  500+
                </div>
                <div className="text-gray-600 text-sm">Lessons</div>
              </div>
              <div>
                <div className="text-orange-600 font-semibold text-xl">
                  4.9★
                </div>
                <div className="text-gray-600 text-sm">User Rating</div>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-300 to-red-300 rounded-3xl blur-3xl opacity-30" />
            <div className="relative bg-white rounded-3xl p-8 shadow-2xl">
              <img
                src={characterStudent}
                alt="Haylingua Student"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-semibold text-gray-900 mb-4">
            Why Choose Haylingua?
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Experience the most engaging way to learn Armenian with our
            comprehensive platform
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Zap className="w-8 h-8 text-orange-600" />}
              title="Bite-sized Lessons"
              text="Learn in just 5–10 minutes a day with focused, effective lessons."
            />
            <FeatureCard
              icon={<Trophy className="w-8 h-8 text-orange-600" />}
              title="Gamified Learning"
              text="Earn XP, unlock achievements, and compete on leaderboards."
            />
            <FeatureCard
              icon={<Users className="w-8 h-8 text-orange-600" />}
              title="Social Learning"
              text="Connect with friends, compete, and learn together."
            />
            <FeatureCard
              icon={<Globe className="w-8 h-8 text-orange-600" />}
              title="Comprehensive Path"
              text="Structured curriculum from beginner to advanced levels."
            />
          </div>
        </div>
      </section>

      {/* Characters Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-semibold text-gray-900 mb-4">
            Meet Your Teachers
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Learn from our friendly characters who guide you through your
            Armenian journey.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <CharacterCard
              image={characterTeacher}
              name="Lilit"
              description="Your main teacher who guides you through lessons with patience and expertise."
            />
            <CharacterCard
              image={characterGrandma}
              name="Grandma Maro"
              description="Shares Armenian culture, traditions, and everyday wisdom through stories."
            />
            <CharacterCard
              image={characterStudent}
              name="Armen"
              description="A fellow learner who practices with you and shares helpful tips."
            />
          </div>
        </div>
      </section>

      {/* Gamification Preview */}
      <section className="bg-gradient-to-b from-orange-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-semibold text-gray-900 mb-12">
            Stay Motivated with Gamification
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <GamificationCard
              icon={
                <Star className="w-6 h-6 text-yellow-600" />
              }
              bg="bg-yellow-100"
              title="XP Points"
              text="Earn points for every lesson completed and milestone reached."
            />
            <GamificationCard
              icon={
                <Heart className="w-6 h-6 text-red-600" />
              }
              bg="bg-red-100"
              title="Hearts System"
              text="Practice makes perfect! Hearts encourage focused learning."
            />
            <GamificationCard
              icon={
                <Trophy className="w-6 h-6 text-purple-600" />
              }
              bg="bg-purple-100"
              title="Leaderboards"
              text="Compete with friends and learners worldwide."
            />
            <GamificationCard
              icon={
                <Award className="w-6 h-6 text-blue-600" />
              }
              bg="bg-blue-100"
              title="Achievements"
              text="Unlock badges and rewards as you progress through levels."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-orange-600 to-red-600 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold text-white mb-6">
            Start Your Armenian Journey Today
          </h2>
          <p className="text-orange-100 mb-8 text-lg">
            Join thousands of learners and discover the beauty of the Armenian
            language.
          </p>
          <button
            onClick={() => openModal("signup")}
            className="px-8 py-4 bg-white text-orange-600 rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
          >
            Get Started Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-orange-600 text-white p-2 rounded-lg">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-white font-semibold">Haylingua</span>
              </div>
              <p className="text-sm">
                The most engaging way to learn Armenian online.
              </p>
            </div>
            <FooterColumn
              title="Learn"
              items={["Lessons", "Vocabulary", "Grammar", "Stories"]}
            />
            <FooterColumn
              title="Community"
              items={["Leaderboards", "Friends", "Forums", "Events"]}
            />
            <FooterColumn
              title="About"
              items={["Our Story", "Team", "Privacy", "Terms"]}
            />
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            © 2025 Haylingua. All rights reserved.
          </div>
        </div>
      </footer>

      {showModal && (
        <LoginModal
          mode={modalMode}
          onClose={() => setShowModal(false)}
          onLogin={onLogin}
          onSignup={onSignup}
          onSwitchMode={(mode) => setModalMode(mode)}
        />
      )}
    </div>
  );
}

function FeatureCard({ icon, title, text }) {
  return (
    <div className="text-center">
      <div className="bg-orange-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <h3 className="text-gray-900 mb-2 font-medium">{title}</h3>
      <p className="text-gray-600 text-sm">{text}</p>
    </div>
  );
}

function CharacterCard({ image, name, description }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow">
      <img
        src={image}
        alt={name}
        className="w-full h-64 object-contain mb-4"
      />
      <h3 className="text-gray-900 text-center mb-2 font-medium">{name}</h3>
      <p className="text-gray-600 text-center text-sm">{description}</p>
    </div>
  );
}

function GamificationCard({ icon, bg, title, text }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-md">
      <div className="flex items-center gap-3 mb-3">
        <div className={`${bg} p-2 rounded-lg`}>{icon}</div>
        <span className="text-gray-900 font-medium">{title}</span>
      </div>
      <p className="text-gray-600 text-sm">{text}</p>
    </div>
  );
}

function FooterColumn({ title, items }) {
  return (
    <div>
      <h4 className="text-white mb-4 font-medium">{title}</h4>
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
