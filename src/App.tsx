import { Navigate, Route, Routes } from "react-router-dom";
import { isSupabaseConfigured } from "./lib/supabase";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { CoursesPage } from "./pages/CoursesPage";
import { CourseDetailsPage } from "./pages/CourseDetailsPage";
import { LoginPage } from "./pages/LoginPage";
import { MyBookingsPage } from "./pages/MyBookingsPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminCourseEditPage } from "./pages/admin/AdminCourseEditPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { RequireOrganiser } from "./components/RequireOrganiser";
import { RequireUser } from "./components/RequireUser";
import { SetupSupabasePage } from "./pages/SetupSupabasePage";

export default function App() {
  if (!isSupabaseConfigured) {
    return <SetupSupabasePage />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/courses/:courseId" element={<CourseDetailsPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/me/bookings"
          element={
            <RequireUser>
              <MyBookingsPage />
            </RequireUser>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireOrganiser>
              <AdminDashboardPage />
            </RequireOrganiser>
          }
        />
        <Route
          path="/admin/courses/:courseId"
          element={
            <RequireOrganiser>
              <AdminCourseEditPage />
            </RequireOrganiser>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireOrganiser>
              <AdminUsersPage />
            </RequireOrganiser>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

