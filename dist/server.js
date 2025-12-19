import express from "express";
const app = express();
const port = process.env.PORT || 5000;
app.get("/", (req, res) => {
    res.send("Hello from Knytr server side");
});
app.listen(port, () => {
    console.log(`Knytr server listening on port ${port}`);
});
//# sourceMappingURL=server.js.map