import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import composeRouter from "./routes/compose.js";

dotenv.config();

const app = express();

// parsers
app.use(cors());
app.use(express.json({ limit: "6mb" }));
app.use(express.urlencoded({ extended: true, limit: "6mb" }));
app.use(express.text({ type: ["text/*", "application/xml"], limit: "6mb" }));

app.get("/healthz", (_req, res) => res.send("ok"));

// mount
app.use("/compose", composeRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`[script-gen] listening on :${port}`));
