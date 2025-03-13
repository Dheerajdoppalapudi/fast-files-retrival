import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import corsOptions from "./src/config/corsConfig.js";
import authRoutes from "./src/routes/authRoutes.js";
import fileRoutes from "./src/routes/fileRoutes.js";

dotenv.config();

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/files", fileRoutes);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
