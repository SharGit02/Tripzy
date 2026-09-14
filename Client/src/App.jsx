import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/Landing/LandingPage";
import CatalogPage from "./pages/Catalog/CatalogPage";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import MyBookingsPage from "./pages/Bookings/MyBookingsPage";
import TripPage from "./pages/Trip/TripPage";
import ProfilePage from "./pages/Profile/ProfilePage";
import ItineraryDetailPage from "./pages/Itinerary/ItineraryDetailPage";
import ShareItineraryPage from "./pages/Itinerary/ShareItineraryPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import GeneratingItineraryPage from "./pages/Itinerary/GeneratingItineraryPage";
import "./styles/index.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Navigate to="/?auth=login" replace />} />
        <Route path="/signup" element={<Navigate to="/?auth=signup" replace />} />
        <Route path="/catalog" element={<Navigate to="/plan" replace />} />
        <Route path="/itinerary" element={<Navigate to="/plan" replace />} />
        <Route path="/share/:id" element={<ShareItineraryPage />} />
        <Route
          path="/plan"
          element={
            <ProtectedRoute>
              <CatalogPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plan/itinerary/generating"
          element={
            <ProtectedRoute>
              <GeneratingItineraryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plan/itinerary/:id"
          element={
            <ProtectedRoute>
              <ItineraryDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plan/itinary/:id"
          element={
            <ProtectedRoute>
              <ItineraryDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plan/:id"
          element={
            <ProtectedRoute>
              <ItineraryDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings"
          element={
            <ProtectedRoute>
              <MyBookingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trip/:id"
          element={
            <ProtectedRoute>
              <TripPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
