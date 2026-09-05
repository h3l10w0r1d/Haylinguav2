// src/lib/authors.js — bio/credentials for blog post authors (E-E-A-T signal
// for educational content — Google explicitly rewards attributing teaching
// content to a credentialed real person over a generic brand byline). Keyed
// by the exact author_name stored on the post (see backend/seed_blog_posts.py's
// _default_author, and CmsBlog.jsx's free-text author field for manual posts).
// A name with no entry here (e.g. the legacy "Haylingua" byline) just renders
// without a bio block — see BlogPostPage.jsx.
export const AUTHOR_PROFILES = {
  "Lilit Hakobyan": {
    role: "Co-founder & Armenian Language Lead",
    bio: "An Armenian language teacher across the IB Diploma Programme and several other institutions — Lilit shapes how Haylingua actually teaches the language.",
  },
  "Armen Ghazaryan": {
    role: "Co-founder & Developer",
    bio: "An IB Diploma Programme graduate of Quantum College, Armen built Haylingua from a school project into a full Armenian-learning app.",
  },
};
