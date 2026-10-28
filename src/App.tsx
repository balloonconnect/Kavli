import { Route, Routes, Navigate } from 'react-router-dom';
import { Landing, Signup, Profile } from './pages/public';
import { Dashboard, Lesson, Tutor, Material } from './pages/student';
import { TestsList, TestInstructions, TestTaking, ResultPage, Certificates, CertificateView } from './pages/tests';
import { Verify } from './pages/verify';
import { ParentDashboard, TeacherBuilder, TeacherResults, AdminCertificates } from './pages/roles';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/verify/:ref" element={<Verify />} />
      <Route path="/app" element={<Dashboard />} />
      <Route path="/app/lesson" element={<Lesson />} />
      <Route path="/app/tutor" element={<Tutor />} />
      <Route path="/app/material" element={<Material />} />
      <Route path="/app/tests" element={<TestsList />} />
      <Route path="/app/tests/:id" element={<TestInstructions />} />
      <Route path="/app/tests/:id/take" element={<TestTaking />} />
      <Route path="/app/tests/:id/result" element={<ResultPage />} />
      <Route path="/app/certificates" element={<Certificates />} />
      <Route path="/app/certificates/:ref" element={<CertificateView />} />
      <Route path="/parent" element={<ParentDashboard />} />
      <Route path="/teacher/builder" element={<TeacherBuilder />} />
      <Route path="/teacher/results" element={<TeacherResults />} />
      <Route path="/admin/certificates" element={<AdminCertificates />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
