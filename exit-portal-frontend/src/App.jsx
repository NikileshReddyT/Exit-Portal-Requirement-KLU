import React from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminLayout from './components/layout/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';
import AdminStudents from './pages/admin/AdminStudents';
import AdminStudentDetails from './pages/admin/AdminStudentDetails';
import AdminCategories from './pages/admin/AdminCategories';
import AdminCategoryDetails from './pages/admin/AdminCategoryDetails';
import AdminCategoriesSummary from './pages/admin/AdminCategoriesSummary';
import AdminCategoryStudents from './pages/admin/AdminCategoryStudents';
import AdminStudentCategoryCourses from './pages/admin/AdminStudentCategoryCourses';
import AdminCategoryCompletion from './pages/admin/AdminCategoryCompletion';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminCourses from './pages/admin/AdminCourses';
import AdminCourseDetails from './pages/admin/AdminCourseDetails';
import AdminGrades from './pages/admin/AdminGrades';
import AdminProgress from './pages/admin/AdminProgress';
import AdminStudentReport from './pages/admin/AdminStudentReport';
import AdminInsights from './pages/admin/AdminInsights';
import AdminDataUpload from './pages/admin/AdminDataUpload';
import AdminDangerZone from './pages/admin/AdminDangerZone';
import SuperAdminDashboard from "./pages/admin/SuperAdminDashboard";
import CategoriesUpload from './pages/admin/upload/CategoriesUpload';
import CoursesUpload from './pages/admin/upload/CoursesUpload';
import CombinedUpload from './pages/admin/upload/CombinedUpload';
import ResultsUpload from './pages/admin/upload/ResultsUpload';
import RegistrationsUpload from './pages/admin/upload/RegistrationsUpload';
import GradesUpload from './pages/admin/upload/GradesUpload';
import Categories from './pages/Categories';
import CategoryDetailsPage from './pages/CategoryDetailsPage';
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { ProgramProvider } from './context/ProgramContext';
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import ScrollToTop from './components/ScrollToTop';

function App() {
  return (
    <BrowserRouter>
      <ProgramProvider>
        <ScrollToTop />
        <Analytics />
        <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/home' element={<Navigate to="/" />} />
        <Route path='/login' element={<Login />} />
        <Route path='/dashboard' element={<Dashboard />} />
        {/* Legacy route for backwards-compatibility */}
        <Route path='/admin/dashboard' element={<Navigate to="/admin/overview" replace />} />

        {/* Admin Console - Normal Admins */}
        <Route path='/admin' element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/overview" replace />} />
          <Route path='overview' element={<AdminOverview />} />
          <Route path='insights' element={<AdminInsights />} />
          <Route path='analytics' element={<AdminAnalytics />} />
          <Route path='students' element={<AdminStudents />} />
          <Route path='students/:studentId' element={<AdminStudentDetails />} />
          <Route path='categories' element={<AdminCategories />} />
          <Route path='categories/:categoryName' element={<AdminCategoryDetails />} />
          <Route path='categories-summary' element={<AdminCategoriesSummary />} />
          <Route path='categories-summary/:categoryName' element={<AdminCategoryStudents />} />
          <Route path='categories-summary/:categoryName/completion' element={<AdminCategoryCompletion />} />
          <Route path='categories-summary/:categoryName/students/:studentId' element={<AdminStudentCategoryCourses />} />
          <Route path='courses' element={<AdminCourses />} />
          <Route path='courses/:courseCode' element={<AdminCourseDetails />} />
          <Route path='grades' element={<AdminGrades />} />
          <Route path='progress' element={<AdminProgress />} />
          <Route path='report' element={<AdminStudentReport />} />
          <Route path='upload' element={<AdminDataUpload />} />
          <Route path='danger' element={<AdminDangerZone />} />
          {/* <Route path='upload/categories' element={<CategoriesUpload />} /> */}
          {/* <Route path='upload/courses' element={<CoursesUpload />} /> */}
          <Route path='upload/combined' element={<CombinedUpload />} />
          <Route path='upload/results' element={<ResultsUpload />} />
          <Route path='upload/registrations' element={<RegistrationsUpload />} />
          {/* <Route path='upload/grades' element={<GradesUpload />} /> */}
        </Route>
        
        {/* Super Admin Console - includes AdminUsers */}
        <Route path='/superadmin' element={<AdminLayout />}>
          <Route index element={<Navigate to="/superadmin/overview" replace />} />
          <Route path='overview' element={<AdminOverview />} />
          <Route path='insights' element={<AdminInsights />} />
          <Route path='analytics' element={<AdminAnalytics />} />
          <Route path='students' element={<AdminStudents />} />
          <Route path='students/:studentId' element={<AdminStudentDetails />} />
          <Route path='categories' element={<AdminCategories />} />
          <Route path='categories/:categoryName' element={<AdminCategoryDetails />} />
          <Route path='categories-summary' element={<AdminCategoriesSummary />} />
          <Route path='categories-summary/:categoryName' element={<AdminCategoryStudents />} />
          <Route path='categories-summary/:categoryName/completion' element={<AdminCategoryCompletion />} />
          <Route path='categories-summary/:categoryName/students/:studentId' element={<AdminStudentCategoryCourses />} />
          <Route path='courses' element={<AdminCourses />} />
          <Route path='courses/:courseCode' element={<AdminCourseDetails />} />
          <Route path='grades' element={<AdminGrades />} />
          <Route path='progress' element={<AdminProgress />} />
          <Route path='report' element={<AdminStudentReport />} />
          <Route path='users' element={<AdminUsers />} />
          <Route path='upload' element={<AdminDataUpload />} />
          <Route path='danger' element={<AdminDangerZone />} />
          {/* <Route path='upload/categories' element={<CategoriesUpload />} /> */}
          {/* <Route path='upload/courses' element={<CoursesUpload />} /> */}
          <Route path='upload/combined' element={<CombinedUpload />} />
          <Route path='upload/results' element={<ResultsUpload />} />
          <Route path='upload/registrations' element={<RegistrationsUpload />} />
          {/* <Route path='upload/grades' element={<GradesUpload />} /> */}
        </Route>
        <Route path='/superadmin/dashboard' element={<SuperAdminDashboard />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/category/:categoryName" element={<CategoryDetailsPage />} />
        <Route path='/forgot-password' element={<ForgotPassword />} />
        <Route path='/reset-password' element={<ResetPassword />} />
        </Routes>
      </ProgramProvider>
    </BrowserRouter>
  );
}

export default App;
