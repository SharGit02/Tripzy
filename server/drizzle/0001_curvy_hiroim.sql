CREATE TABLE "flight_fare_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"origin" varchar(60) NOT NULL,
	"destination" varchar(60) NOT NULL,
	"search_start_date" date NOT NULL,
	"window_days" integer DEFAULT 30 NOT NULL,
	"best_date" date,
	"best_airline" varchar(120),
	"best_flight_number" integer,
	"best_predicted_fare" numeric(12, 2),
	"results" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flight_fare_predictions" ADD CONSTRAINT "flight_fare_predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;