import { Navigate, Route, Routes } from 'react-router-dom';
import { Guard } from './auth';
import { Shell } from './components/Shell';
import { PublicLayout, Landing, Features, HowItWorks, Privacy, Terms, ChildSafety, Help, NotFound, SignIn } from './pages/public';
import { Dashboard } from './pages/student';
import { Tutor } from './pages/tutor';
import type { ReactNode } from 'react';
import type { Role } from './auth';

const P = (el: ReactNode) => <PublicLayout>{el}</PublicLayout>;
const S = (roles: Role[], el: ReactNode) => <Guard roles={roles}><Shell>{el}</Shell></Guard>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={P(<Landing />)} /><Route path="/features" element={P(<Features />)} /><Route path="/how-it-works" element={P(<HowItWorks />)} />
      <Route path="/privacy" element={P(<Privacy />)} /><Route path="/terms" element={P(<Terms />)} /><Route path="/child-safety" element={P(<ChildSafety />)} /><Route path="/help" element={P(<Help />)} />
      <Route path="/signin" element={P(<SignIn />)} />
      <Route path="/app" element={S(['student'], <Dashboard />)} />
      <Route path="/app/tutor" element={S(['student'], <Tutor />)} />
      <Route path="/app/*" element={<Navigate to="/app" replace />} />
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={P(<NotFound />)} />
    </Routes>
  );
}
