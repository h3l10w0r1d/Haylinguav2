// src/lib/mascotFaces.js
// Exercise-feedback mascot faces (public/banners/faces/) — two characters,
// three emotional states each. One character is picked at random per lesson
// session and stays consistent for its duration (not re-rolled per exercise).
const FACES = {
  armen: {
    positive: "/banners/faces/Armen_positive.webp",
    neutral: "/banners/faces/Armen_Neutral.webp",
    negative: "/banners/faces/Armen_negative.webp",
  },
  lilit: {
    positive: "/banners/faces/Lilit_positive.webp",
    neutral: "/banners/faces/Lilit_neutral.webp",
    negative: "/banners/faces/Lilit_Negative.webp",
  },
};

export function pickMascotCharacter() {
  return Math.random() < 0.5 ? "armen" : "lilit";
}

export function mascotFaceUrl(character, state) {
  const set = FACES[character] || FACES.armen;
  return set[state] || set.neutral;
}
