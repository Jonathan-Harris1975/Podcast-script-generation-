import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import composeRouter from "./routes/compose.js";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req, res) => res.send("ok"));
app.use("/compose", composeRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`[script-gen] listening on :${port}`));