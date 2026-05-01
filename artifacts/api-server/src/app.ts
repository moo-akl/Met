import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { ZodError } from "zod";
import router from "./routes";
import legalRouter from "./routes/legal";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Public legal pages — `/support` and `/privacy` — required by the
// App Store and Play Store. These are mounted at the root (not under
// `/api`) so they show up at clean URLs like https://met.app/support.
app.use(legalRouter);

// JSON error handler so async route exceptions don't escape as HTML.
// Express 5 forwards thrown promises here automatically.
app.use(
  (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof ZodError) {
      req.log?.warn({ err }, "validation error");
      res.status(400).json({
        message: "Validation error",
        issues: err.issues,
      });
      return;
    }
    req.log?.error({ err }, "unhandled route error");
    res.status(500).json({ message: "Internal server error" });
  },
);

export default app;
