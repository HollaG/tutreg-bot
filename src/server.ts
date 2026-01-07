import express, { Request, Response } from "express";
import { bot } from ".";

const app = express();
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
  (req: Request<{}, {}, SendMessageRequest>, res: Response) => {
    const { t_id, swap_id, name, event } = req.body;
    const body = req.body;
    console.log("Received /sendMessage request", { t_id, name, event });

    switch (event) {
      case UserEvent.SWAP_CREATED:
        handleSwapCreated(body);
        break;
      case UserEvent.SWAP_REQUESTED:
        handleSwapRequested(body);
        break;
      case UserEvent.SWAP_REQUESTED_COMPLETED:
        handleRequestedSwapCompleted(body);
        break;
      case UserEvent.SWAP_CREATED_COMPLETED:
        handleCreatedSwapCompleted(body);
        break;
    }

    res.status(200).json({ success: true, message: "Message received" });
  }
);

app.listen(PORT, "localhost", () => {
  console.log(`Server is running on localhost:${PORT}`);
});

const handleSwapCreated = (body: SendMessageRequest) => {
  const header = `✅ <a href='${ROOT_URL}swap/${body.swap_id}'><b>Swap request created</b></a> ✅\n\n`;
  const msg =
    header +
    `Hi ${body.name}, your swap has been created successfully! If anyone wants to swap with you, you'll be notified here. Good luck!`;

  console.log("Swap Created Message:", msg);
  bot.telegram.sendMessage(body.t_id, msg, {
    parse_mode: "HTML",
  });
};

const handleSwapRequested = (body: SendMessageRequest) => {
  const header = `✅ <a href='${ROOT_URL}swap/${body.swap_id}'><b>Swap requested</b></a> ✅\n\n`;

  const msg =
    header +
    `Hi ${body.name}, you have requested a swap. The other party has been notified, and they will contact you directly. Your Telegram handle has been shared with them. Best of luck!`;
  bot.telegram.sendMessage(body.t_id, msg, {
    parse_mode: "HTML",
  });
};
const handleRequestedSwapCompleted = (body: SendMessageRequest) => {
  const header = `✅ <a href='${ROOT_URL}swap/${body.swap_id}'><b>Swap request completed</b></a> ✅\n\n`;
  const msg =
    header +
    `Hi ${body.name}, the swap that you requested has been marked as complete. \n<i>If the creator did not contact you, this means that they are not interested in swapping with you anymore. Feel free to create a new swap request if you wish to swap with someone else. Thank you for using TutReg!</i>`;
  bot.telegram.sendMessage(body.t_id, msg, {
    parse_mode: "HTML",
  });
};
const handleCreatedSwapCompleted = (body: SendMessageRequest) => {
  const header = `✅ <a href='${ROOT_URL}swap/${body.swap_id}'><b>Swap created completed</b></a> ✅\n\n`;
  const msg =
    header +
    `Hi ${body.name}, your swap has been marked as complete. Thank you for using TutReg!`;
  bot.telegram.sendMessage(body.t_id, msg, {
    parse_mode: "HTML",
  });
};
