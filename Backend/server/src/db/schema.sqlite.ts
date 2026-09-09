import {
    sqliteTable,
    text,
    integer,
    real,
    uniqueIndex,
    check,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

// Use text with check constraints for enums (SQLite doesn't have native enums)
export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    name: text("name", { length: 120 }).notNull(),
    email: text("email", { length: 255 }).notNull(),
    password: text("password").notNull(),
    role: text("role").notNull().default("user"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => ({
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
    roleCheck: check("role_check", sql`${table.role} IN ('user', 'admin')`),
}));

export const userProfiles = sqliteTable("user_profiles", {
    userId: text("user_id")
        .primaryKey()
        .references(() => users.id, { onDelete: "cascade" }),
    username: text("username", { length: 50 }),
    phoneNumber: text("phone_number", { length: 20 }),
    dateOfBirth: integer("date_of_birth", { mode: "timestamp" }),
    gender: text("gender"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    homeCity: text("home_city", { length: 100 }),
    homeCountry: text("home_country", { length: 100 }),
    travelInterests: text("travel_interests", { mode: "json" }),
    preferredTravelStyle: text("preferred_travel_style", { length: 50 }),
    budgetMin: real("budget_min"),
    budgetMax: real("budget_max"),
    budgetCurrency: text("budget_currency", { length: 3 }).default("INR"),
    preferredLanguage: text("preferred_language", { length: 50 }),
    marketingOptIn: integer("marketing_opt_in", { mode: "boolean" }).notNull().default(false),
    onboardingCompleted: integer("onboarding_completed", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => ({
    usernameUnique: uniqueIndex("user_profiles_username_unique").on(table.username),
    genderCheck: check("gender_check", sql`${table.gender} IN ('male', 'female', 'other', 'prefer_not_to_say')`),
}));

export const bookings = sqliteTable("bookings", {
    id: text("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("other"),
    status: text("status").notNull().default("pending"),
    title: text("title", { length: 200 }).notNull(),
    destination: text("destination", { length: 150 }),
    origin: text("origin", { length: 150 }),
    startDate: integer("start_date", { mode: "timestamp" }),
    endDate: integer("end_date", { mode: "timestamp" }),
    guests: integer("guests").default(1),
    totalAmount: real("total_amount"),
    currency: text("currency", { length: 3 }).default("INR"),
    bookingReference: text("booking_reference", { length: 40 }),
    notes: text("notes"),
    metadata: text("metadata", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => ({
    bookingReferenceUnique: uniqueIndex("bookings_reference_unique").on(table.bookingReference),
    typeCheck: check("type_check", sql`${table.type} IN ('flight', 'hotel', 'package', 'activity', 'transport', 'other')`),
    statusCheck: check("status_check", sql`${table.status} IN ('pending', 'confirmed', 'cancelled', 'completed')`),
}));

export const searchHistory = sqliteTable("search_history", {
    id: text("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    query: text("query", { length: 255 }).notNull(),
    filters: text("filters", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const flightFarePredictions = sqliteTable("flight_fare_predictions", {
    id: text("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    origin: text("origin", { length: 60 }).notNull(),
    destination: text("destination", { length: 60 }).notNull(),
    searchStartDate: integer("search_start_date", { mode: "timestamp" }).notNull(),
    windowDays: integer("window_days").notNull().default(30),
    bestDate: integer("best_date", { mode: "timestamp" }),
    bestAirline: text("best_airline", { length: 120 }),
    bestFlightNumber: integer("best_flight_number"),
    bestPredictedFare: real("best_predicted_fare"),
    results: text("results", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ── relations ───────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ one, many }) => ({
    profile: one(userProfiles, {
        fields: [users.id],
        references: [userProfiles.userId],
    }),
    bookings: many(bookings),
    searchHistory: many(searchHistory),
    flightFarePredictions: many(flightFarePredictions),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
    user: one(users, {
        fields: [userProfiles.userId],
        references: [users.id],
    }),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
    user: one(users, {
        fields: [bookings.userId],
        references: [users.id],
    }),
}));

export const searchHistoryRelations = relations(searchHistory, ({ one }) => ({
    user: one(users, {
        fields: [searchHistory.userId],
        references: [users.id],
    }),
}));

export const flightFarePredictionsRelations = relations(flightFarePredictions, ({ one }) => ({
    user: one(users, {
        fields: [flightFarePredictions.userId],
        references: [users.id],
    }),
}));

// ── row types ────────────────────────────────────────────────────────────
export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type UserProfileRow = typeof userProfiles.$inferSelect;
export type NewUserProfileRow = typeof userProfiles.$inferInsert;
export type BookingRow = typeof bookings.$inferSelect;
export type NewBookingRow = typeof bookings.$inferInsert;
export type SearchHistoryRow = typeof searchHistory.$inferSelect;
export type NewSearchHistoryRow = typeof searchHistory.$inferInsert;
export type FlightFarePredictionRow = typeof flightFarePredictions.$inferSelect;
export type NewFlightFarePredictionRow = typeof flightFarePredictions.$inferInsert;