CREATE TABLE "hotel_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cache_key" varchar(300) NOT NULL,
	"destination" varchar(150) NOT NULL,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"adults" integer DEFAULT 2 NOT NULL,
	"results" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "hotel_cache_key_unique" ON "hotel_cache" USING btree ("cache_key");