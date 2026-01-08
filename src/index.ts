import { Context, Telegraf } from "telegraf";

import dotenv from "dotenv";
dotenv.config();

import "./server"; // Start the Express server

export const bot: Telegraf<Context> = new Telegraf(
  process.env.BOT_TOKEN as string
);

import db from "mysql2/promise";
import {
  ClassSwapRequest,
  ClassSwapRequestDB,
  ExtendedUser,
  ModuleWithClassDB,
  SwapReplies,
  SwapToNotify,
  TelegramUser,
} from "./types/types";
import { cleanArrayString } from "./lib/functions.js";
import cron from "cron";
import {
  addCollectionListener,
  buildSwapRequestMessage,
  COLLECTION_NAME,
  fireDb,
  signIn,
} from "./lib/firebase";
import {
  QuerySnapshot,
  DocumentData,
  setDoc,
  updateDoc,
  getDoc,
  doc,
} from "firebase/firestore";
import {
  handleCreatedSwapCompleted,
  handleRequestedSwapCompleted,
  ROOT_URL,
  UserEvent,
} from "./server";
(async () => {
  const conn = await db
    .createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      port: parseInt(process.env.MYSQL_PORT as string),
    })
    .then((conn) => conn);

  const signedInSuccessfully = await signIn();

  if (signedInSuccessfully) {
    console.log("Signed in successfully!");
  } else {
    console.error("Failed to sign in!");
    return;
  }

  bot.start((ctx) =>
    ctx.reply(
      "Welcome! Head over to https://tutreg.com to make your first swap request!"
    )
  );

  bot.launch();
  console.log("Bot is running!");

  bot.on("callback_query", async (ctx) => {
    try {
      console.log("callback query for complete");
      console.log(JSON.stringify(ctx.callbackQuery, null, 2));
      const cbData = ctx.callbackQuery;

      // @ts-ignore
      const cId = cbData.data;

      const [id, swapId, tId] = (cId as string).split("_");

      if (id === "complete") {
        /** The following code is duplicated from the main tutreg repository: pages\api\swap\[swapId].ts:295 */
        // get the swap
        const [swaps]: [ClassSwapRequestDB[], db.FieldPacket[]] =
          await conn.query(
            "SELECT * FROM swaps WHERE swapId = ? AND from_t_id = ?",
            [swapId, tId]
          );

        if (swaps.length === 0) {
          ctx.answerCbQuery();
          return ctx.reply("Swap not found or you are not the creator.");
        }

        if (swaps[0].status === "Completed") {
          ctx.answerCbQuery();
          return ctx.reply("This swap has already been completed.");
        }
        // delete the swap
        await conn.query(
          "UPDATE swaps SET status = ? WHERE swapId = ? AND from_t_id = ?",
          ["Completed", swapId, tId]
        );

        // get all the requests for this swap (on firebase)
        const docRef = doc(fireDb, COLLECTION_NAME, swapId.toString());
        const data = await getDoc(docRef);

        // for each request, notify the user that the swap has been completed
        if (data.exists()) {
          const docData = data.data() as SwapReplies;
          const requests = docData.requests;
          for (const req of requests) {
            // sendTelegramAlert(
            //   UserEvent.SWAP_REQUESTED_COMPLETED,
            //   req.requestorId,
            //   Number(swapId),
            //   req.requestorName
            // );
            handleRequestedSwapCompleted(
              {
                t_id: req.requestorId,
                name: req.requestorName,
                swap_id: Number(swapId),
                event: UserEvent.SWAP_REQUESTED_COMPLETED,
              },
              swaps[0]
            );
          }
        }

        // send a notif to the creator
        handleCreatedSwapCompleted(
          {
            t_id: parseInt(tId),
            name: ctx.from?.first_name || "there",
            swap_id: Number(swapId),
            event: UserEvent.SWAP_CREATED_COMPLETED,
          },
          swaps[0]
        );

        ctx.answerCbQuery("Marked swap as completed!");

        // delete the "complete" button message
        return ctx.editMessageReplyMarkup({
          inline_keyboard: [
            [
              {
                text: "View swap request",
                url: `${ROOT_URL}swap/${swapId}`,
              },
            ],
          ],
        });
      }
    } catch (e) {
      console.error("Error handling callback query:", e);
      ctx.reply(
        "An error occurred while processing your request. Please try again later."
      );
    }
  });

  const onUpdate = async (snapshot: QuerySnapshot<DocumentData>) => {
    console.log("Recieved a live update!");
    snapshot.docChanges().forEach(async (change) => {
      const data = change.doc.data() as SwapReplies;
      if (!data) return;

      const requests = data.requests;
      const swapId = change.doc.id;

      // check to see if there are any new requests that have status 'new' --> not been notified
      // console.log(JSON.stringify(requests, null, 2));
      const newRequestsToNotify = requests.filter(
        (request) => request.requested.status === "new"
      );

      // since we don't use batched requests, there should only be one new request at all times.
      // TODO: check the reliability of this system
      // if (newRequestsToNotify.length !== 1) {
      //   // no new requests to notify
      //   return console.log("No new requests to notify");
      // }

      if (newRequestsToNotify.length === 0) {
        return console.log("No new requests to notify");
      }

      const [swaps]: [
        (ClassSwapRequest & { can_notify: boolean })[],
        db.FieldPacket[]
      ] = await conn.query(
        `SELECT * FROM swaps LEFT JOIN users ON swaps.from_t_id = users.id WHERE swapId = ?`,
        [swapId]
      );

      if (!swaps.length) return console.log("ERROR: no swaps with this id");
      const swap = swaps[0];

      // get the creator's class
      const [creatorClasses]: [ModuleWithClassDB[], db.FieldPacket[]] =
        await conn.query(
          `SELECT * FROM modulelist LEFT JOIN classlist ON modulelist.moduleCode = classlist.moduleCode WHERE ay = ? AND semester = ? AND classlist.moduleCode = ? AND classlist.lessonType = ? AND classlist.classNo = ?`,
          [
            process.env.AY,
            process.env.SEM,
            swap.moduleCode,
            swap.lessonType,
            swap.classNo,
          ]
        );

      if (!creatorClasses.length) {
        // return console.log("ERROR: Could not find the creator's class");
        throw new Error("Could not find the creator's class");
      }

      for (const newRequestToNotify of newRequestsToNotify) {
        try {
          const [otherRequestorArray]: [ExtendedUser[], db.FieldPacket[]] =
            await conn.query(`SELECT * FROM users WHERE id = ?`, [
              newRequestToNotify.requestorId,
            ]);
          if (!otherRequestorArray.length) {
            // return console.log("ERROR: no user with this id");
            throw new Error("Could not find other requestor");
          }

          const otherRequestor = otherRequestorArray[0];

          if (!swap.can_notify) {
            console.log("ERROR: user has disabled notifications");
            continue;
          }

          // get the classes that the other person has and wants to swap with original
          // might be more than 1 class

          const [otherClasses]: [ModuleWithClassDB[], db.FieldPacket[]] =
            await conn.query(
              `SELECT * FROM modulelist LEFT JOIN classlist ON modulelist.moduleCode = classlist.moduleCode WHERE ay = ? AND semester = ? AND classlist.moduleCode = ? AND classlist.lessonType = ? AND classlist.classNo = ?`,
              [
                process.env.AY,
                process.env.SEM,
                newRequestToNotify.requested.moduleCode,
                newRequestToNotify.requested.lessonType,
                newRequestToNotify.requested.classNo,
              ]
            );

          if (!otherClasses.length) {
            throw new Error("Could not find the other person's class");
          }

          // build a message to send
          const msg = buildSwapRequestMessage(
            newRequestToNotify,
            swap,
            otherRequestor,
            otherClasses,
            creatorClasses
          );

          bot.telegram.sendMessage(swap.from_t_id, msg, {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "View swap request",
                    url: `${ROOT_URL}swap/${swap.swapId}`,
                  },
                  // {
                  //   text: "Share swap request",

                  // }
                ],
                [
                  {
                    text: "Complete swap ✅",
                    callback_data: `complete_${swap.swapId}_${swap.from_t_id}`,
                  },
                ],
              ],
            },
          });
        } catch (e) {
          console.error("Error while notifying requestor:", e);
        }
      }

      // update the request to 'notified'
      updateDoc(change.doc.ref, {
        requests: requests.map((req) => {
          if (req.requested.status === "new") {
            // update this request to 'notified'
            return {
              ...req,
              requested: {
                ...req.requested,
                status: "notified",
              },

              lastUpdated: new Date(),
            };
          } else {
            return req;
          }
        }),
      });
    });
  };

  const unsubscribe = addCollectionListener({
    next: onUpdate,
  });

  const URL = process.env.URL; // ends with slash
  const messageBuilder = (
    swapsToNotify: SwapToNotify[],
    users: TelegramUser[]
  ) => {
    console.log({ users });
    const { username, first_name } = swapsToNotify[0].swap;
    let message = `<b>Update on tutorial swaps</b>\nHi ${first_name}! ${
      swapsToNotify.length
    } of your swaps ${
      swapsToNotify.length === 1 ? `has an update` : `have updates`
    }\n\n`;
    for (const swapToNotify of swapsToNotify) {
      const { moduleCode, lessonType, classNo, swapId } = swapToNotify.swap;

      message += `<a href='${URL}${swapId}'>${moduleCode} ${lessonType} ${classNo}</a>`;

      if (swapToNotify.newRequestors.length) {
        message += `\n`;
        message += swapToNotify.newRequestors
          .map((requestor) => {
            const user = users.find((user) => user.id.toString() === requestor);
            if (!user) return "";
            return `<a href='t.me/${user.username}'>+ ${user.first_name}</a>`;
          })
          .join("\n");
        message += `\n`;
      }
      if (swapToNotify.removedRequestors.length) {
        message += `\n`;
        message += swapToNotify.removedRequestors
          .map((requestor) => {
            const user = users.find((user) => user.id.toString() === requestor);
            if (!user) return "";
            return `- ${user.first_name}`;
          })
          .join("\n");
        message += `\n`;
      }

      if (swapToNotify.unchangedRequestors.length) {
        message += `\n`;
        message += swapToNotify.unchangedRequestors
          .map((requestor) => {
            const user = users.find((user) => user.id.toString() === requestor);
            if (!user) return "";
            return `<a href='t.me/${user.username}'>• ${user.first_name}</a>`;
          })
          .join("\n");
        message += `\n`;
      }
    }

    message += `\nContact them to arrange your swap!`;
    return message;
  };

  // the below is deprecated
  // run every 15 minutes

  // for every user in the database,
  // 1) select all swaps that each user has made
  // 2) for each swap, select the swap in the updated table
  // 3) compare the 2 swaps' requestor fields, if changed, return the change
  // 4) send a message to the user
  // 5) drop the old swap table and replace it with the updated table

  //   interface GroupedByUserId {
  //     [key: string]: ClassSwapRequest[];
  //   }
  //   const notify = async () => {
  //     try {
  //       console.log("Running notify");

  //       const [newSwaps]: [ClassSwapRequest[], db.FieldPacket[]] =
  //         await conn.query(
  //           `SELECT * FROM swaps LEFT JOIN users ON swaps.from_t_id = users.id WHERE status = "Open" AND notified = false ORDER BY createdAt DESC`
  //         );
  //       const [oldSwaps]: [ClassSwapRequest[], db.FieldPacket[]] =
  //         await conn.query(
  //           `SELECT * FROM swaps_old LEFT JOIN users ON swaps_old.from_t_id = users.id WHERE status = "Open" ORDER BY createdAt DESC`
  //         );

  //       const [users]: [ExtendedUser[], db.FieldPacket[]] = await conn.query(
  //         `SELECT * FROM users`
  //       );

  //       // group newSwaps and oldSwaps by userId
  //       const newGrouped = newSwaps.reduce<GroupedByUserId>((r, a) => {
  //         r[a.from_t_id] = [...(r[a.from_t_id] || []), a];
  //         return r;
  //       }, {});

  //       // 1 for every swap in person in newSwap (which means that they haven't been notified),
  //       // 2 look in oldSwaps to find the swapId if it exists
  //       //     2.1 If it exists, then check the requestors property to see the changes.
  //       //     2.2 Else, a person has requested this swap within 15mins before this function ran - treat the requestors property as an empty string
  //       // 3 send a message to the user
  //       // 4 update the notified column to true in swaps

  //       console.log(newGrouped);
  //       for (const userId in newGrouped) {
  //         const swaps = newGrouped[userId];

  //         const swapsToNotify: SwapToNotify[] = [];
  //         for (const swap of swaps) {
  //           const swapId = swap.swapId;

  //           // find in oldSwaps
  //           const oldSwap = oldSwaps.find((swap) => swap.swapId === swapId);

  //           let oldSwapRequestors: string[] = [];
  //           if (oldSwap) oldSwapRequestors = cleanArrayString(oldSwap.requestors);

  //           const newSwapRequestors = cleanArrayString(swap.requestors);
  //           // find the difference between the 2 arrays
  //           // in new but not old
  //           const newRequestors = newSwapRequestors.filter(
  //             (requestor) => !oldSwapRequestors.includes(requestor)
  //           );

  //           // in old but not new
  //           const removedRequestors = oldSwapRequestors.filter(
  //             (requestor) => !newSwapRequestors.includes(requestor)
  //           );

  //           // in old and in new
  //           const unchangedRequestors = newSwapRequestors.filter((requestor) =>
  //             oldSwapRequestors.includes(requestor)
  //           );

  //           const swapToNotify = {
  //             swap,
  //             newRequestors,
  //             removedRequestors,
  //             unchangedRequestors,
  //           };
  //           swapsToNotify.push(swapToNotify);
  //         }

  //         // send a message to the user

  //         const message = messageBuilder(swapsToNotify, users);

  //         // if (userId === "899565250")
  //         const user = users.find((user) => user.id.toString() === userId);
  //         if (user?.can_notify) {
  //           console.log(`Sent a notification to ${user.first_name}`);
  //           await bot.telegram.sendMessage(userId, message, {
  //             parse_mode: "HTML",
  //             disable_web_page_preview: true,
  //           });
  //         } else {
  //           console.log(`Did not send a notification to ${user?.first_name}`);
  //         }

  //         // update the notified column to true in swaps
  //         await conn.query(
  //           `UPDATE swaps SET notified = true WHERE from_t_id = ?`,
  //           [userId]
  //         );
  //       }

  //       // copy databases

  //       await conn.query(`DELETE FROM swaps_old`);
  //       await conn.query(`INSERT INTO swaps_old SELECT * FROM swaps`);

  //       // await executeQuery({
  //       //     query: `DELETE FROM swaps_old`,
  //       //     values: [],
  //       // });

  //       // await executeQuery({
  //       //     query: `INSERT INTO swaps_old SELECT * FROM swaps`,
  //       //     values: [],
  //       // });
  //     } catch (e) {
  //       console.log(e);
  //     }
  //   };

  //   // notify();

  //   // every 15 minutes
  //   // setInterval(() => notify(), 15 * 60 * 1000);
  //   const job = new cron.CronJob(
  //     "1 */15 * * * *",
  //     notify,
  //     null,
  //     true,
  //     "Asia/Singapore"
  //   );
})();
