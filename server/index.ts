import path from "path";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import passport from "./middlewares/passport";
import mongoSanitize from "express-mongo-sanitize";
import swaggerUi from "swagger-ui-express";
import swaggerDoc from "./definitions/swagger.json";
import mainRoutes from './routes/index';
import errorHandler from './middlewares/errorHandler';
import { connectDB } from './config/database';

dotenv.config({ path: path.join(__dirname, "./.env") });

process.env.rootDir = __dirname;

const PORT = process.env.PORT || 3001;
const app = express();

app.use(express.json());
app.use(cors());
app.use(passport.initialize());
app.use(mongoSanitize());
app.use(express.urlencoded({ extended: false }));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
app.use("/", mainRoutes);
app.use(errorHandler);

const start = async () => {
    try {
        await connectDB();
    } catch (error) {
        console.error('Failed to start server:', (error as Error).message);
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`Server is listening on port: ${PORT}\n`);
        console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
    });
};

if (require.main === module) {
    start();
}

export default app;
