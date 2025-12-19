import express, { type Request, type Response } from "express";

const app = express();
const port = process.env.PORT ?? 5000;

app.get("/", (req: Request, res: Response) => {
  res.send("Hello from Knytr server side");
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Knytr server listening on port ${port}`);
});
