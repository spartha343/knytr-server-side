import type { Server } from "http";
import app from "./app.js";

// handle uncaught exception
process.on("uncaughtException", (error) => {
  // TODO: handle error logger instead of console.log if necessary on all files
  // eslint-disable-next-line no-console
  console.log(error);
  process.exit(1);
});

const port: number = Number(process.env.PORT) || 5000;

let server: Server;

const main = async () => {
  try {
    server = app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Knytr server listening on port ${port}`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log("Failed to connect to Database !", error);
  }

  process.on("unhandledRejection", (error) => {
    if (server) {
      server.close(() => {
        // eslint-disable-next-line no-console
        console.log(error);
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });
};

main();

process.on("SIGTERM", () => {
  // eslint-disable-next-line no-console
  console.log("SIGTERM is received");
  if (server) {
    server.close();
  }
});
