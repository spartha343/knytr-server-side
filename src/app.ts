import express, {
  type Application,
  type NextFunction,
  type Request,
  type Response
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import httpStatus from "http-status";
import globalErrorHandler from "./app/middlewares/globalErrorHandler.ts";
import routes from "./app/routes/index.ts";

const app: Application = express();

// middlewares
app.use(cookieParser());
// TODO: check the origin while deploying the app
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// module routes here
app.use("/api/v1", routes);

// testing
// app.get("/", async (req: Request, res: Response) => {

// });

// Global error handler
app.use(globalErrorHandler);

//handle Not Found routes
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: "Not Found !!",
    errorMessages: [
      {
        path: req.originalUrl,
        message: "API Not Found !"
      }
    ]
  });
  next();
});

export default app;
