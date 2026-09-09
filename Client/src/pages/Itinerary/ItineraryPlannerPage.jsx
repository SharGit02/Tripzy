import { Navigate } from "react-router-dom";

/** Kept so Vite HMR does not break old module URLs after the planner moved to /plan. */
export default function ItineraryPlannerPage() {
  return <Navigate to="/plan" replace />;
}
