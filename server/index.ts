import "./config/env";
import express from "express";
import path from "path";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "./middlewares/passport";
import mongoSanitize from "express-mongo-sanitize";
import swaggerUi from "swagger-ui-express";
import swaggerDoc from "./definitions/swagger.json";
import mainRoutes from "./routes/index";
import errorHandler from "./middlewares/errorHandler";
import { connectDB } from "./config/database";
import { Server } from "socket.io";
import { setupSocketHandlers } from "./socket/socket-handlers";

process.env.rootDir = __dirname;

const PORT = process.env.PORT || 3001;
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});
setupSocketHandlers(io);

app.use(express.json());
app.use(cors());
app.use(cookieParser());
app.use(passport.initialize());
app.use(mongoSanitize());
app.use(express.urlencoded({ extended: false }));

import { UPLOADS_DIR } from "./config/env";
app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));
app.use("/", mainRoutes);
app.use(errorHandler);

const start = async () => {
  try {
    await connectDB();
  } catch (error) {
    console.error("Failed to start server:", (error as Error).message);
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log(`Server is listening on port: ${PORT}\n`);
    console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
  });
};

if (require.main === module) {
  start();
}

export { io };
export default app;
