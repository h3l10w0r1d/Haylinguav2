// src/cms/journey/templateVariables.js — the {{token}} substitution
// vocabulary shared by every channel a step can send through (email, app
// push, web push). Must stay in sync with backend/automations.py's
// _template_variables(), which is what actually renders these at send
// time — this file only drives the CMS picker UI and the sample-data
// preview.
export const VARIABLES = [
  { token: "first_name", label: "First name", sample: "Alex" },
  { token: "username", label: "Username", sample: "alex99" },
  { token: "name", label: "Name", sample: "Alex" },
  { token: "email", label: "Email", sample: "alex@example.com" },
  { token: "streak", label: "Current streak (days)", sample: "7" },
  { token: "best_streak", label: "Best streak (days)", sample: "30" },
  { token: "gems", label: "Gem balance", sample: "250" },
  { token: "weekly_xp", label: "XP this week", sample: "420" },
  { token: "league", label: "League", sample: "Gold" },
];

export function withSampleData(text) {
  if (!text) return text;
  let out = text;
  for (const v of VARIABLES) out = out.split(`{{${v.token}}}`).join(v.sample);
  return out;
}
