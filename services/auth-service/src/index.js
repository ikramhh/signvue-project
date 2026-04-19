const express = require("express");
const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
    res.json({ status: "ok-auth-service" });
});

app.get("/verify", (req, res) => {
    res.json({ ok: true });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log("auth-service running on", PORT);
});