// @ts-check
import * as InboxSDK from "@inboxsdk/core";
import EventEmitter from "events";
import { marked } from "marked";
import * as inbox from "./inbox";
import * as openai from "./openai";
import { parseThreadView } from "./parsers";
import "./styles.css";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY not set");
}

/** @param {{thread: ReturnType<typeof parseThreadView>, user: Awaited<ReturnType<typeof inbox.getUser>>}} param */
const getOnComposeOpenHandler = ({ thread, user }) => {
  /** @param {InboxSDK.ComposeView} composeView */
  const onComposeOpen = async (composeView) => {
    let hint = "";

    const retrieveResponses = async () => {
      // const result = openai.requestMock(5);
      const result = openai.request({
        apiKey: OPENAI_API_KEY,
        body: { ...thread, user, hint },
      });
      inbox.setButtonsLoading(true);
      for await (const { description, body } of result) {
        inbox.insertButton({
          description,
          body,
          onClick: () => {
            composeView.setBodyHTML(marked.parse(body));
          },
        });
      }
      inbox.setButtonsLoading(false);
    };

    inbox.insertSuggestionHintInput({
      onSubmit: (newHint) => {
        hint = newHint;
        retrieveResponses();
      },
    });

    retrieveResponses();
  };
  return onComposeOpen;
};

async function main() {
  const gmailEventEmitter = new EventEmitter();
  const user = await inbox.getUser();

  inbox.onCompose({
    onDestroy: () => gmailEventEmitter.emit("compose:close"),
    onCreate: (composeView) => {
      gmailEventEmitter.emit("compose:open", composeView);
    },
  });

  /** @type {ReturnType<typeof getOnComposeOpenHandler> | null} */
  let currentThreadOnComposeOpenHandler = null;
  inbox.onThread({
    onDestroy: () => {
      if (currentThreadOnComposeOpenHandler) {
        gmailEventEmitter.off(
          "compose:open",
          currentThreadOnComposeOpenHandler
        );
        currentThreadOnComposeOpenHandler = null;
      }
    },
    onCreate: (threadView) => {
      const thread = parseThreadView(threadView);
      currentThreadOnComposeOpenHandler = getOnComposeOpenHandler({
        thread,
        user,
      });
      gmailEventEmitter.on("compose:open", currentThreadOnComposeOpenHandler);
    },
  });
}

main();
