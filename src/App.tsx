import { Navigate, Route, Routes } from 'react-router-dom';
import { Guard } from './auth';
import { Shell } from './components/Shell';
import { PublicLayout, Landing, Features, HowItWorks, Privacy, Terms, ChildSafety, Help, NotFound, SignIn, ForgotPassword } from './pages/public';
import { SignUp } from './pages/signup';
import { Dashboard, Learn, Lesson, Bookmarks, Homework, Progress_, Practice } from './pages/student';
import { ProfilePage, Settings } from './pages/profile';
import { Material } from './pages/material';
import { TestsList, TestDetail, TakeTest, Result, Review } from './pages/tests';
import { Certificates, Verify } from './pages/certs';
import { Tutor } from './pages/tutor';
import type { ReactNode } from 'react';
import type { Role } from './auth';

const P = (el: ReactNode) => <PublicLayout>{el}</PublicLayout>;
const ALL: Role[] = ['student', 'parent', 'teacher', 'school_admin', 'admin', 'pending'];
const S = (roles: Role[], el: ReactNode) => <Guard roles={roles}><Shell>{el}</Shell></Guard>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={P(<Landing />)} /><Route path="/features" element={P(<Features />)} /><Route path="/how-it-works" element={P(<HowItWorks />)} />
      <Route path="/privacy" element={P(<Privacy />)} /><Route path="/terms" element={P(<Terms />)} /><Route path="/child-safety" element={P(<ChildSafety />)} /><Route path="/help" element={P(<Help />)} />
      <Route path="/signin" element={P(<SignIn />)} /><Route path="/forgot-password" element={P(<ForgotPassword />)} /><Route path="/login" element={<Navigate to="/signin" replace />} /><Route path="/signup" element={P(<SignUp />)} />
      <Route path="/app" element={S(ALL, <Dashboard />)} />
      <Route path="/app/tutor" element={S(['student'], <Tutor />)} />
      <Route path="/app/learn" element={S(['student'], <Learn />)} /><Route path="/app/learn/:id" element={S(['student'], <Lesson />)} />
      <Route path="/app/material" element={S(['student'], <Material />)} /><Route path="/app/practice" element={S(['student'], <Practice />)} />
      <Route path="/app/tests" element={S(['student'], <TestsList />)} /><Route path="/app/tests/:id" element={S(['student'], <TestDetail />)} />
      <Route path="/app/take/:id" element={S(['student'], <TakeTest />)} /><Route path="/app/result/:id" element={S(['student'], <Result />)} /><Route path="/app/review/:id" element={S(['student'], <Review />)} />
      <Route path="/app/progress" element={S(['student'], <Progress_ />)} /><Route path="/app/certificates" element={S(['student'], <Certificates />)} />
      <Route path="/app/homework" element={S(['student'], <Homework />)} /><Route path="/app/bookmarks" element={S(['student'], <Bookmarks />)} /><Route path="/app/settings" element={S(['student'], <Settings />)} />
      <Route path="/profile" element={<Guard roles={['student']} allowIncompleteProfile><ProfilePage /></Guard>} />
      <Route path="/verify" element={<Verify />} /><Route path="/verify/:token" element={<Verify />} />
      <Route path="/app/*" element={<Navigate to="/app" replace />} />
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={P(<NotFound />)} />
    </Routes>
  );
}
