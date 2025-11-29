// src/components/Dashboard.tsx

import { Lock, Star, Check, Trophy, Flame, Target } from 'lucide-react';
import type { User, Lesson } from '../App';
import characterTeacher from '../assets/character-teacher.png'; // <-- same pattern as LandingPage

type DashboardProps = {
  user: User;
  onStartLesson: (lesson: Lesson) => void;
};

// -------- Mock lesson data --------

const getLessons = (completedLessons: string[]): Lesson[] => {
  const allLessons = [
    {
      id: 'lesson-1',
      title: 'Greetings',
      description: 'Learn basic Armenian greetings',
      level: 1,
      xp: 50,
      exercises: [],
    },
    {
      id: 'lesson-2',
      title: 'The Alphabet',
      description: 'Master the Armenian alphabet',
      level: 1,
      xp: 75,
      exercises: [],
    },
    {
      id: 'lesson-3',
      title: 'Numbers 1–10',
      description: 'Count from one to ten',
      level: 1,
      xp: 60,
      exercises: [],
    },
    {
      id: 'lesson-4',
      title: 'Basic Phrases',
      description: 'Common everyday expressions',
      level: 2,
      xp: 80,
      exercises: [],
    },
    {
      id: 'lesson-5',
      title: 'Family Members',
      description: 'Words for family relationships',
      level: 2,
      xp: 70,
      exercises: [],
    },
    {
      id: 'lesson-6',
      title: 'Food & Drink',
      description: 'Learn food vocabulary',
      level: 2,
      xp: 85,
      exercises: [],
    },
    {
      id: 'lesson-7',
      title: 'Colors',
      description: 'Names of different colors',
      level: 3,
      xp: 65,
      exercises: [],
    },
    {
      id: 'lesson-8',
      title: 'Days & Time',
      description: 'Tell time and days of week',
      level: 3,
      xp: 90,
      exercises: [],
    },
    {
      id: 'lesson-9',
      title: 'Weather',
      description: 'Describe the weather',
      level: 3,
      xp: 70,
      exercises: [],
    },
    {
      id: 'lesson-10',
      title: 'Directions',
      description: 'Ask for and give directions',
      level: 4,
      xp: 95,
      exercises: [],
    },
    {
      id: 'lesson-11',
      title: 'Shopping',
      description: 'Shopping vocabulary and phrases',
      level: 4,
      xp: 100,
      exercises: [],
    },
    {
      id: 'lesson-12',
      title: 'At Restaurant',
      description: 'Order food and drinks',
      level: 4,
      xp: 90,
      exercises: [],
    },
    {
      id: 'lesson-13',
      title: 'Hobbies',
      description: 'Talk about your interests',
      level: 5,
      xp: 110,
      exercises: [],
    },
    {
      id: 'lesson-14',
      title: 'Travel',
      description: 'Essential travel phrases',
      level: 5,
      xp: 105,
      exercises: [],
    },
    {
      id: 'lesson-15',
      title: 'Professions',
      description: 'Job titles and occupations',
      level: 5,
      xp: 95,
      exercises: [],
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

const generateExercises = (lessonId: string) => {
  if (lessonId === 'lesson-1') {
    return [
      {
        id: 'ex-1',
        type: 'multiple-choice' as const,
        question: 'How do you say "Hello" in Armenian?',
        options: [
          'Բարև (Barev)',
          'Ողջույն (Voghdjuyn)',
          'Ցտեսություն (Tstesutyun)',
          'Շնորհակալություն (Shnorhakalutyun)',
        ],
        correctAnswer: 'Բարև (Barev)',
      },
      {
        id: 'ex-2',
        type: 'translate' as const,
        question: 'Translate: Good morning',
        correctAnswer: 'Բարի լույս',
      },
      {
        id: 'ex-3',
        type: 'multiple-choice' as const,
        question: 'What does "Ցտեսություն" mean?',
        options: ['Hello', 'Goodbye', 'Thank you', 'Please'],
        correctAnswer: 'Goodbye',
      },
      {
        id: 'ex-4',
        type: 'fill-blank' as const,
        question: 'Complete: Բարի _____ (Good night)',
        correctAnswer: 'գիշեր',
      },
      {
        id: 'ex-5',
        type: 'multiple-choice' as const,
        question: 'How do you say "Thank you"?',
        options: ['Խնդրում եմ', 'Շնորհակալություն', 'Ներողություն', 'Բարև'],
        correctAnswer: 'Շնորհակալություն',
      },
    ];
  }

  // Default exercises for other lessons
  return [
    {
      id: 'ex-1',
      type: 'multiple-choice' as const,
      question: 'Sample question for this lesson',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option A',
    },
    {
      id: 'ex-2',
      type: 'translate' as const,
      question: 'Translate this phrase',
      correctAnswer: 'Translation',
    },
    {
      id: 'ex-3',
      type: 'fill-blank' as const,
      question: 'Fill in the blank: _____',
      correctAnswer: 'answer',
    },
  ];
};

// -------- Dashboard UI --------

export default function Dashboard({ user, onStartLesson }: DashboardProps) {
  const lessons = getLessons(user.completedLessons);
  const levelGroups = lessons.reduce((acc, lesson) => {
    if (!acc[lesson.level]) acc[lesson.level] = [];
    acc[lesson.level].push(lesson);
    return acc;
  }, {} as Record<number, Lesson[]>);

  const progress = (user.completedLessons.length / lessons.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pb-20">
      {/* Top banner – matches landing gradient vibe */}
      <header className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-4 py-8 shadow-sm">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-6 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold mb-2">
                Welcome back, {user.name}! 👋
              </h1>
              <p className="text-orange-100 text-sm md:text-base">
                Continue your Armenian journey and keep your streak alive.
              </p>
            </div>
            <div className="hidden md:block">
              <img
                src={characterTeacher}
                alt="Teacher Anna"
                className="w-32 h-32 object-contain drop-shadow-lg"
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-5 h-5" />
                <span className="text-xs text-orange-100">Level</span>
              </div>
              <div className="text-2xl font-semibold">{user.level}</div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-5 h-5" />
                <span className="text-xs text-orange-100">Total XP</span>
              </div>
              <div className="text-2xl font-semibold">{user.xp}</div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="w-5 h-5" />
                <span className="text-xs text-orange-100">Day streak</span>
              </div>
              <div className="text-2xl font-semibold">{user.streak}</div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-5 h-5" />
                <span className="text-xs text-orange-100">Completed</span>
              </div>
              <div className="text-2xl font-semibold">
                {user.completedLessons.length}/{lessons.length}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-orange-100 uppercase tracking-wide">
                Overall progress
              </span>
              <span className="text-sm font-medium">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Learning path */}
      <main className="max-w-5xl mx-auto px-4 py-10">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Your learning path
        </h2>

        <div className="space-y-12">
          {Object.entries(levelGroups).map(([level, levelLessons]) => (
            <section key={level}>
              {/* Level chip + line */}
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-orange-600 text-white px-4 py-2 rounded-full text-sm shadow-sm">
                  Level {level}
                </div>
                <div className="flex-1 h-[2px] bg-gradient-to-r from-orange-200 to-transparent rounded-full" />
              </div>

              <div className="grid gap-6">
                {levelLessons.map((lesson, index) => (
                  <div
                    key={lesson.id}
                    className={`relative ${
                      index % 2 === 0 ? 'md:mr-auto' : 'md:ml-auto'
                    } w-full md:w-[380px]`}
                  >
                    <button
                      onClick={() => !lesson.isLocked && onStartLesson(lesson)}
                      disabled={lesson.isLocked}
                      className={`w-full p-5 rounded-2xl border shadow-sm text-left transition-all duration-200 ${
                        lesson.isCompleted
                          ? 'bg-green-50 border-green-400 hover:shadow-md'
                          : lesson.isLocked
                          ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                          : 'bg-white border-orange-200 hover:border-orange-400 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                            lesson.isCompleted
                              ? 'bg-green-500'
                              : lesson.isLocked
                              ? 'bg-gray-400'
                              : 'bg-orange-500'
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

                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">
                            {lesson.title}
                          </h3>
                          <p className="text-sm text-gray-600 mb-2">
                            {lesson.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-orange-600 flex items-center gap-1">
                              <Star className="w-4 h-4" />
                              {lesson.xp} XP
                            </span>

                            {lesson.isCompleted && (
                              <span className="text-green-600 font-medium">
                                ✓ Completed
                              </span>
                            )}

                            {lesson.isLocked && (
                              <span className="text-gray-500">
                                Locked • finish previous lesson
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Vertical connector between cards (desktop only) */}
                    {index < levelLessons.length - 1 && (
                      <div className="hidden md:block absolute top-full left-1/2 w-[2px] h-8 bg-gray-300/80 transform -translate-x-1/2" />
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Motivational callout */}
        <section className="mt-12 bg-gradient-to-r from-orange-100 to-red-100 rounded-2xl p-8 text-center shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Keep up the great work! 🎉
          </h3>
          <p className="text-gray-600 text-sm md:text-base">
            You&apos;re making excellent progress. Complete a short lesson
            every day to maintain your streak and unlock new levels.
          </p>
        </section>
      </main>
    </div>
  );
}
