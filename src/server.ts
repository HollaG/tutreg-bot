import express, { Request, Response } from "express";
import { bot } from ".";
import {
  ClassSwapRequest,
  ClassSwapRequestDB,
  ModuleWithClassDB,
} from "./types/types";
import db from "mysql2/promise";
import { combineNumbersDatabase, convertDayToAbbrev } from "./lib/functions";

const app = express();
let conn: db.Connection;
const PORT = Number(process.env.PORT) || 9000;

app.use(express.json());

export const ROOT_URL = process.env.ROOT_URL || "http://localhost:3000";

export enum UserEvent {
  SWAP_CREATED,
  // SWAP_REQUESTED,
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
      (ClassSwapRequestDB & { can_notify: boolean })[],
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
      // case UserEvent.SWAP_REQUESTED:
      //   handleSwapRequested(body, swap);
      //   break;
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

const feedback = `<i><a href='https://forms.gle/BUKeoGLq5SQ9Kg8W9'>Provide feedback</a> (much appreciated)!</i>`;
const handleSwapCreated = async (
  body: SendMessageRequest,
  swap: ClassSwapRequestDB
) => {
  // extra data required:
  // details of the creator's class

  const [creatorClasses]: [ModuleWithClassDB[], db.FieldPacket[]] =
    await conn.query(
      `SELECT * FROM classlist WHERE ay = ? AND semester = ? AND moduleCode = ? AND lessonType = ? AND classNo = ?`,
      [
        process.env.AY,
        process.env.SEM,
        swap.moduleCode,
        swap.lessonType,
        swap.classNo,
      ]
    );

  const header = `✅ <a href='${ROOT_URL}swap/${body.swap_id}'><b>Swap request created</b></a> ✅\n\n`;
  let msg =
    header +
    `Hi ${body.name}, your swap for \n<b>${swap.moduleCode} ${swap.lessonType} [${swap.classNo}]</b>\n`;

  creatorClasses.forEach((c, i) => {
    msg += `${i !== creatorClasses.length - 1 ? "├" : "└"} ${convertDayToAbbrev(
      c.day
    )} ${c.startTime} — ${c.endTime} (Wks ${combineNumbersDatabase(
      c.weeks
    )})\n`;
  });

  msg += `\nhas been created successfully! If anyone wants to swap with you, you'll be notified here. Good luck!\n\n<i>Please remember to mark your swap as completed if you have successfully swapped with someone.</i>`;

  console.log("Swap Created Message:", msg);
  bot.telegram.sendMessage(body.t_id, msg, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "View swap request",
            url: `${ROOT_URL}swap/${body.swap_id}`,
          },
          // {
          //   text: "Share swap request",

          // }
        ],
        [
          {
            text: "Complete swap ✅",
            callback_data: `complete_${body.swap_id}_${body.t_id}`,
          },
        ],
      ],
    },
  });
};

export const handleRequestedSwapCompleted = (
  body: SendMessageRequest,
  swap: ClassSwapRequestDB
) => {
  const header = `✅ <a href='${ROOT_URL}swap/${body.swap_id}'><b>Swap request completed</b></a> ✅\n\n`;
  const msg =
    header +
    `Hi ${body.name}, the class <b>${swap.moduleCode} ${swap.lessonType} [${swap.classNo}]</b> that you requested for has been swapped. \n\n<i>If the creator did not contact you, this means the swap has been completed with someone else. Feel free to create a new swap request if you still wish for a swap. Thank you for using TutReg!</i>\n\n${feedback}`;
  bot.telegram.sendMessage(body.t_id, msg, {
    parse_mode: "HTML",
  });
};
export const handleCreatedSwapCompleted = (
  body: SendMessageRequest,
  swap: ClassSwapRequestDB
) => {
  const header = `✅ <a href='${ROOT_URL}swap/${body.swap_id}'><b>Swap completed</b></a> ✅\n\n`;
  const msg =
    header +
    `Hi ${body.name}, your swap for <b>${swap.moduleCode} ${swap.lessonType} [${swap.classNo}]</b> has been marked as complete. Thank you for using TutReg!\n\n${feedback}`;
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
