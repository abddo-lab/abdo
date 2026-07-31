import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;
// Middleware
app.use(cors());
app.use(express.json());
// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
// Health check
app.get("/api/health", (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
});
// Start server
app.listen(PORT, () => {
    console.log(`Kiren server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
export default app;
