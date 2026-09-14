import { Router } from "express";

import authRoutes from "../features/auth/auth.routes.js";
import userRoutes from "../features/users/user.routes.js";
import bookingRoutes from "../features/bookings/booking.routes.js";
import searchHistoryRoutes from "../features/search-history/search-history.routes.js";
import healthRoutes from "../features/health/health.routes.js";
import weatherRoutes from "../features/weather/weather.routes.js";
import flightFareRoutes from "../features/flightFare/flightFare.routes.js";
import itineraryRoutes from "../features/itinerary/itinerary.routes.js";
import { getPublicItinerary } from "../features/itinerary/itinerary.controller.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/bookings", bookingRoutes);
router.use("/search-history", searchHistoryRoutes);
router.use("/weather", weatherRoutes);
router.use("/flight-fare", flightFareRoutes);
router.get("/plan/:id/public", getPublicItinerary);
router.get("/itinerary/:id/public", getPublicItinerary);
router.use("/plan", itineraryRoutes);
router.use("/itinerary", itineraryRoutes);

export default router;
