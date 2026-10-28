// DEMO DATA ONLY — replace with API calls. Scoring and pass/fail must be decided server-side.
export type Result = 'Passed' | 'Not passed' | 'Pending review';
export const student = { name: 'Meenakshi Kumar', ta: 'மீனாட்சி குமார்', first: 'Meena', class: 8 };
export const subjects = [
  { name: 'Mathematics', pct: 84 }, { name: 'Science', pct: 72 }, { name: 'English', pct: 62 },
  { name: 'Social Science', pct: 34 }, { name: 'Tamil', pct: 90 },
];
export const tests = [
  { id: 'maths-7', title: 'Mathematics — Weekly Test 7', status: 'Available', due: 'Fri 30 Oct, 6:00 PM IST', minutes: 45, marks: 50, pass: 20 },
  { id: 'maths-6', title: 'Mathematics — Weekly Test 6', status: 'Passed', got: 42, marks: 50, pass: 20, date: '24 Oct' },
  { id: 'english-6', title: 'English — Weekly Test 6', status: 'Passed', got: 31, marks: 50, pass: 20, date: '24 Oct' },
  { id: 'social-5', title: 'Social Science — Weekly Test 5', status: 'Not passed', got: 17, marks: 50, pass: 20, date: '17 Oct' },
];
export const questions = [
  { id: 1, type: 'MCQ', marks: 2, text: 'Solve: 3x + 5 = 20', options: ['x = 3', 'x = 5', 'x = 7', 'x = 15'] },
  { id: 2, type: 'MCQ', marks: 2, text: 'Solve: 5x − 3 = 22', options: ['x = 4', 'x = 5', 'x = 6', 'x = 25'] },
  { id: 3, type: 'MCQ', marks: 2, text: 'A number increased by 7 gives 19. The number is…', options: ['10', '12', '14', '26'] },
  { id: 4, type: 'Short answer', marks: 5, text: 'Form an equation: twice a number minus 4 is 10.', options: [] },
];
export const certificates = [
  { ref: 'KM-2026-WT-000417', title: 'Mathematics — Weekly Test 6', date: '24 Oct 2026', marks: '42 / 50 · 84%', status: 'Valid' },
  { ref: 'KM-2026-WT-000418', title: 'English — Weekly Test 6', date: '24 Oct 2026', marks: '31 / 50 · 62%', status: 'Valid' },
  { ref: 'KM-2026-WT-000388', title: 'English — Weekly Test 4', date: '3 Oct 2026', marks: '30 / 50 · 60%', status: 'Revoked' },
];
export const topics = [
  { t: 'Forming equations', got: 10, tot: 10 }, { t: 'One-step equations', got: 14, tot: 15 },
  { t: 'Two-step equations', got: 12, tot: 15 }, { t: 'Equation word problems', got: 6, tot: 10 },
];
