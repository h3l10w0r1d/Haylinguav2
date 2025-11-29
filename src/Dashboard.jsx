// src/Dashboard.jsx

import { Lock, Star, Check, Trophy, Flame, Target } from "lucide-react";
import characterTeacher from "./assets/character-teacher.png"; // adjust path if needed

// ---- Helpers to generate lessons & exercises ----

const generateExercises = (lessonId) => {
  if (lessonId === "lesson-1") {
    return [
      {
        id: "ex-1",
        type: "multiple-choice",
        question: 'How do you say "Hello" in Armenian?',
        options: [
          "Բարև (Barev)",
          "Ողջույն (Voghdjuyn)",
          "Ցտեսություն (Tstesutyun)",
          "Շնորհակալություն (Shnorhakalutyun)",
        ],
        correctAnswer: "Բարև (Barev)",
      },
      {
        id: "ex-2",
        type: "translate",
        question: "Translate: Good morning",
        correctAnswer: "Բարի լույս",
      },
      {
        id: "ex-3",
        type: "multiple-choice",
        question: 'What does "Ցտեսություն" mean?',
        options: ["Hello", "Goodbye", "Thank you", "Please"],
        correctAnswer: "Goodbye",
      },
      {
        id: "ex-4",
        type: "fill-blank",
        question: "Complete: Բարի _____ (Good night)",
        correctAnswer: "գիշեր",
      },
      {
        id: "ex-5",
        type: "multiple-choice",
        question: 'How do you say "Thank you"?',
        options: ["Խնդրում եմ", "Շնորհակալություն", "Ներողություն", "Բարև"],
        correctAnswer: "Շնորհակալություն",
      },
    ];
  }

  // default exercises for other lessons
  return [
    {
      id: "ex-1",
      type: "multiple-choice",
      question: "Sample question for this lesson",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswer: "Option A",
    },
    {
      id: "ex-2",
      type: "translate",
      question: "Translate this phrase",
      correctAnswer: "Translation",
    },
    {
      id: "ex-3",
      type: "fill-blank",
      question: "Fill in the blank: _____",
      correctAnswer: "answer",
    },
  ];
};

const getLessons = (completedLessons) => {
  const allLessons = [
    {
      id: "lesson-1",
      title: "Greetings",
      description: "Learn basic Armenian greetings",
      level: 1,
      xp: 50,
    },
    {
      id: "lesson-2",
      title: "The Alphabet",
      description: "Master the Armenian alphabet",
      level: 1,
      xp: 75,
    },
    {
      id: "lesson-3",
      title: "Numbers 1-10",
      description: "Count from one to ten",
      level: 1,
      xp: 60,
    },
    {
      id: "lesson-4",
      title: "Basic Phrases",
      description: "Common everyday expressions",
      level: 2,
      xp: 80,
    },
    {
      id: "lesson-5",
      title: "Family Members",
      description: "Words for family relationships",
      level: 2,
      xp: 70,
    },
    {
      id: "lesson-6",
      title: "Food & Drink",
      description: "Learn food vocabulary",
      level: 2,
      xp: 85,
    },
    {
      id: "lesson-7",
      title: "Colors",
      description: "Names of different colors",
      level: 3,
      xp: 65,
    },
    {
      id: "lesson-8",
      title: "Days & Time",
      description: "Tell time and days of week",
      level: 3,
      xp: 90,
    },
    {
      id: "lesson-9",
      title: "Weather",
      description: "Describe the weather",
      level: 3,
      xp: 70,
    },
    {
      id: "lesson-10",
      title: "Directions",
      description: "Ask for and give directions",
      level: 4,
      xp: 95,
    },
    {
      id: "lesson-11",
      title: "Shopping",
      description: "Shopping vocabulary and phrases",
      level: 4,
      xp: 100,
    },
    {
      id: "lesson-12",
      title: "At Restaurant",
      description: "Order food and drinks",
      level: 4,
      xp: 90,
    },
    {
      id: "lesson-13",
      title: "Hobbies",
      description: "Talk about your interests",
      level: 5,
      xp: 110,
    },
    {
      id: "lesson-14",
      title: "Travel",
      description: "Essential travel phrases",
      level: 5,
      xp: 105,
    },
    {
      id: "lesson-15",
      title: "Professions",
      description: "Job titles and occupations",
      level: 5,
      xp: 95,
    },
  ];

  return allLessons.map((lesson, index) => {
    const isCompleted = completedLessons.includes(lesson.id);
    const previousCompleted =
      index === 0 || completedLessons.includes(allLessons[index - 1].id);
    const isLocked = !previousCompleted && !isCompleted;

    return {
      ...lesson,
      isCompleted,
      isLocked,
      exercises: generateExercises(lesson.id),
    };
  });
};

// ---- Component ----

export default function Dashboard({ user, onStartLesson }) {
  const completedLessons = user.completedLessons || [];
  const lessons = getLessons(completedLessons);

  const levelGroups = lessons.reduce((acc, lesson) => {
    if (!acc[lesson.level]) acc[lesson.level] = [];
    acc[lesson.level].push(lesson);
    return acc;
  }, {});

  const progress = (completedLessons.length / lessons.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pb-20">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="mb-2">Welcome back, {user.name}! 👋</h1>
              <p className="text-orange-100">Continue your Armenian journey</p>
            </div>
            <div className="hidden md:block">
              <img
                src={characterTeacher}
                alt="Teacher Anna"
                className="w-32 h-32 object-contain"
              />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[rgb(15,204,0)] bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5" />
                <span className="text-sm text-orange-100">Level</span>
              </div>
              <div className="text-2xl font-bold">{user.level}</div>
            </div>

            <div className="bg-[rgb(15,204,0)] bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5" />
                <span className="text-sm text-orange-100">Total XP</span>
              </div>
              <div className="text-2xl font-bold">{user.xp}</div>
            </div>

            <div className="bg-[rgb(15,204,0)] bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-5 h-5" />
                <span className="text-sm text-orange-100">Day Streak</span>
              </div>
              <div className="text-2xl font-bold">{user.streak}</div>
            </div>

            <div className="bg-[rgb(15,204,0)] bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5" />
                <span className="text-sm text-orange-100">Completed</span>
              </div>
              <div className="text-2xl font-bold">
                {completedLessons.length}/{lessons.length}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-orange-100">Overall Progress</span>
              <span className="text-sm">{Math.round(progress)}%</span>
            </div>
            <div className="h-3 bg-white bg-opacity-20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Learning Path */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-gray-900 mb-6">Your Learning Path</h2>

        <div className="space-y-12">
          {Object.entries(levelGroups).map(([level, levelLessons]) => (
            <div key={level}>
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-orange-600 text-white px-4 py-2 rounded-full">
                  Level {level}
                </div>
                <div className="flex-1 h-1 bg-gray-200 rounded" />
              </div>

              <div className="grid gap-4">
                {levelLessons.map((lesson, index) => (
                  <div
                    key={lesson.id}
                    className={`relative ${
                      index % 2 === 0 ? "md:mr-auto" : "md:ml-auto"
                    } w-full md:w-96`}
                  >
                    <button
                      onClick={() =>
                        !lesson.isLocked && onStartLesson(lesson)
                      }
                      disabled={lesson.isLocked}
                      className={`w-full p-6 rounded-2xl border-2 transition-all ${
                        lesson.isCompleted
                          ? "bg-green-50 border-green-500 hover:shadow-lg"
                          : lesson.isLocked
                          ? "bg-gray-100 border-gray-300 cursor-not-allowed opacity-60"
                          : "bg-white border-orange-300 hover:border-orange-500 hover:shadow-lg"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 ${
                            lesson.isCompleted
                              ? "bg-green-500"
                              : lesson.isLocked
                              ? "bg-gray-400"
                              : "bg-orange-500"
                          }`}
                        >
                          {lesson.isCompleted ? (
                            <Check className="w-8 h-8 text-white" />
                          ) : lesson.isLocked ? (
                            <Lock className="w-8 h-8 text-white" />
                          ) : (
                            <Star className="w-8 h-8 text-white" />
                          )}
                        </div>

                        <div className="flex-1 text-left">
                          <h3 className="text-gray-900 mb-1">
                            {lesson.title}
                          </h3>
                          <p className="text-gray-600 text-sm mb-2">
                            {lesson.description}
                          </p>
                          <div className="flex items-center gap-4">
                            <span className="text-orange-600 text-sm flex items-center gap-1">
                              <Star className="w-4 h-4" />
                              {lesson.xp} XP
                            </span>
                            {lesson.isCompleted && (
                              <span className="text-green-600 text-sm">
                                ✓ Completed
                              </span>
                            )}
                            {lesson.isLocked && (
                              <span className="text-gray-500 text-sm">
                                Locked
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Connecting Line */}
                    {index < levelLessons.length - 1 && (
                      <div className="hidden md:block absolute top-full left-1/2 w-1 h-8 bg-gray-300 transform -translate-x-1/2" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Motivational Section */}
        <div className="mt-12 bg-gradient-to-r from-orange-100 to-red-100 rounded-2xl p-8 text-center">
          <h3 className="text-gray-900 mb-2">Keep up the great work! 🎉</h3>
          <p className="text-gray-600">
            You're making excellent progress. Complete daily lessons to maintain
            your streak!
          </p>
        </div>
      </div>
    </div>
  );
}
