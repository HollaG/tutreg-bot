import express, { Request, Response } from "express";
import { bot } from ".";
import { ClassSwapRequest, ModuleWithClassDB } from "./types/types";
import db from "mysql2/promise";

const app = express();
let conn: db.Connection;
const PORT = Number(process.env.PORT) || 9000;

app.use(express.json());

const ROOT_URL = process.env.ROOT_URL || "http://localhost:3000";

export enum UserEvent {
  SWAP_CREATED,
  SWAP_REQUESTED,
  SWAP_REQUESTED_COMPLETED,
  SWAP_CREATED_COMPLETED,
}

interface SendMessageRequest {
  t_id: number;
  swap_id: number;
  name: string;
  event: UserEvent; // TODO: Replace with UserEvent type later
}

app.post(
  "/sendMessage",
  async (req: Request<{}, {}, SendMessageRequest>, res: Response) => {
    const { t_id, swap_id, name, event } = req.body;
    const body = req.body;
    console.log("Received /sendMessage request", { t_id, name, event });

    // get info about the swap
    const [swaps]: [
      (ClassSwapRequest & { can_notify: boolean })[],
      db.FieldPacket[]
    ] = await conn.query(
      `SELECT * FROM swaps LEFT JOIN users ON swaps.from_t_id = users.id WHERE swapId = ?`,
      [swap_id]
    );

    if (!swaps.length) return console.log("ERROR: no swaps with this id");
    const swap = swaps[0];

    // // get the creator's class
    // const [creatorClasses]: [ModuleWithClassDB[], db.FieldPacket[]] =
    //   await conn.query(
    //     `SELECT * FROM modulelist LEFT JOIN classlist ON modulelist.moduleCode = classlist.moduleCode WHERE ay = ? AND semester = ? AND classlist.moduleCode = ? AND classlist.lessonType = ? AND classlist.classNo = ?`,
    //     [
    //       process.env.AY,
    //       process.env.SEM,
    //       swap.moduleCode,
    //       swap.lessonType,
    //       swap.classNo,
    //     ]
    //   );

    // if (!creatorClasses.length) {
    //   return console.log("ERROR: Could not find the creator's class");
    // }

    switch (event) {
      case UserEvent.SWAP_CREATED:
        handleSwapCreated(body, swap);
        break;
      case UserEvent.SWAP_REQUESTED:
        handleSwapRequested(body, swap);
        break;
      case UserEvent.SWAP_REQUESTED_COMPLETED:
        handleRequestedSwapCompleted(body, swap);
        break;
      case UserEvent.SWAP_CREATED_COMPLETED:
        handleCreatedSwapCompleted(body, swap);
        break;
    }

    res.status(200).json({ success: true, message: "Message received" });
  }
);

const handleSwapCreated = (
  body: SendMessageRequest,
  swap: ClassSwapRequest
) => {
  const header = `✅ <a href='${ROOT_URL}swap/${body.swap_id}'><b>Swap request created</b></a> ✅\n\n`;
  const msg =
    header +
    `Hi ${body.name}, your swap for <b>${swap.moduleCode} ${swap.lessonType} [${swap.classNo}]</b> has been created successfully! If anyone wants to swap with you, you'll be notified here. Good luck!`;

  console.log("Swap Created Message:", msg);
  bot.telegram.sendMessage(body.t_id, msg, {
    parse_mode: "HTML",
  });
};

const handleSwapRequested = (
  body: SendMessageRequest,
  swap: ClassSwapRequest
) => {
  const header = `✅ <a href='${ROOT_URL}swap/${body.swap_id}'><b>Swap requested</b></a> ✅\n\n`;

  const msg =
    header +
    `Hi ${body.name}, you have requested a swap to <b>${swap.moduleCode} ${swap.lessonType} [${swap.classNo}]</b>. The other party has been notified, and they will contact you directly. Your Telegram handle has been shared with them. Best of luck!`;
  bot.telegram.sendMessage(body.t_id, msg, {
    parse_mode: "HTML",
  });
};
const handleRequestedSwapCompleted = (
  body: SendMessageRequest,
  swap: ClassSwapRequest
) => {
  const header = `✅ <a href='${ROOT_URL}swap/${body.swap_id}'><b>Swap request completed</b></a> ✅\n\n`;
  const msg =
    header +
    `Hi ${body.name}, the class <b>${swap.moduleCode} ${swap.lessonType} [${swap.classNo}]</b> that you requested for has been swapped. \n<i>If the creator did not contact you, this means that they are not interested in swapping with you anymore. Feel free to create a new swap request if you wish to swap with someone else. Thank you for using TutReg!</i>`;
  bot.telegram.sendMessage(body.t_id, msg, {
    parse_mode: "HTML",
  });
};
const handleCreatedSwapCompleted = (
  body: SendMessageRequest,
  swap: ClassSwapRequest
) => {
  const header = `✅ <a href='${ROOT_URL}swap/${body.swap_id}'><b>Swap completed</b></a> ✅\n\n`;
  const msg =
    header +
    `Hi ${body.name}, your swap for <b>${swap.moduleCode} ${swap.lessonType} [${swap.classNo}]</b> has been marked as complete. Thank you for using TutReg!`;
  bot.telegram.sendMessage(body.t_id, msg, {
    parse_mode: "HTML",
  });
};

(async () => {
  conn = await db
    .createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      port: parseInt(process.env.MYSQL_PORT as string),
    })
    .then((conn) => conn);

  app.listen(PORT, "localhost", () => {
    console.log(`Server is running on localhost:${PORT}`);
  });
})();
