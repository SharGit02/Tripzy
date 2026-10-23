import { Router } from "express";

import authRoutes from "../features/auth/auth.routes.js";
import userRoutes from "../features/users/user.routes.js";
import bookingRoutes from "../features/bookings/booking.routes.js";
import searchHistoryRoutes from "../features/search-history/search-history.routes.js";
import healthRoutes from "../features/health/health.routes.js";
import weatherRoutes from "../features/weather/weather.routes.js";
import flightFareRoutes from "../features/flightFare/flightFare.routes.js";
import railFareRoutes from "../features/railFare/railFare.routes.js";
import busFareRoutes from "../features/busFare/busFare.routes.js";
import hotelRoutes from "../features/hotels/hotels.routes.js";
import itineraryRoutes from "../features/itinerary/itinerary.routes.js";
import { getPublicItinerary } from "../features/itinerary/itinerary.controller.js";
import { publicItineraryRateLimiter } from "../middlewares/rateLimit.middleware.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/bookings", bookingRoutes);
router.use("/search-history", searchHistoryRoutes);
router.use("/weather", weatherRoutes);
router.use("/flight-fare", flightFareRoutes);
router.use("/rail-fare", railFareRoutes);
router.use("/bus-fare", busFareRoutes);
router.use("/hotels", hotelRoutes);
router.get("/plan/:id/public", publicItineraryRateLimiter, getPublicItinerary);
router.get("/itinerary/:id/public", publicItineraryRateLimiter, getPublicItinerary);
router.use("/plan", itineraryRoutes);
router.use("/itinerary", itineraryRoutes);

export default router;
