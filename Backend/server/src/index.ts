import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import chalk from "chalk";
import morgan from "morgan";
import helmet from "helmet";

import { env } from "./config/env.js";
import { corsOptions } from "./config/cors.js";
import { connectDatabase } from "./db/client.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import router from "./routes/index.js";

const app = express();

// Render (and most single-hop PaaS reverse proxies) sit in front of the app
// and set X-Forwarded-For. Trusting exactly one hop lets express-rate-limit
// (and req.ip generally) resolve the real client IP instead of the proxy's.
app.set("trust proxy", 1);

app.use(morgan("dev"));
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
    })
);
app.use(cors(corsOptions));
app.use(cookieParser());
// Deliberately no express.urlencoded: cookies are SameSite=None in production,
// and a form-encoded POST is a CORS "simple request" that skips preflight, so
// parsing form bodies would hand every other site the ability to make
// authenticated writes (CSRF). Requiring JSON forces a preflight, which the
// origin allowlist then blocks. Every client of this API sends JSON.
// Body size is capped so a single request cannot exhaust process memory.
app.use(express.json({ limit: "100kb" }));

app.use("/api", router);
app.use(errorMiddleware);

async function startServer() {
    await connectDatabase();
    app.listen(env.PORT, () => {
        console.log(chalk.green(`### Server is running on port ${env.PORT}`));
        console.log(chalk.blue(`### Allowed origins: ${env.CORS_ORIGIN_LIST.join(", ")}`));
        console.log(chalk.yellow(`### NODE_ENV resolved to: "${env.NODE_ENV}"`));
    });
}

startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});
