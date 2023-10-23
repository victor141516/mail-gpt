// @ts-check
import Turndown from "turndown";

/** @typedef {import('@inboxsdk/core').ThreadView} ThreadView */
/** @typedef {import('@inboxsdk/core').MessageView} MessageView */

/** @param {string} html */
const html2md = (html) => {
  const turndownService = new Turndown();
  return turndownService.turndown(html);
};

/** @param {ThreadView} threadView */
export const parseThreadView = (threadView) => {
  const allMessageViews = threadView.getMessageViewsAll();
  if (allMessageViews.length === 0) {
    throw new Error("No messages found");
  }
  const lastMessageView = /** @type {MessageView} */ (allMessageViews.at(-1));
  const lastMessage = lastMessageView.getBodyElement();

  if (!lastMessage) {
    console.error("Could not find last message", lastMessageView);
    throw new Error("Could not find last message");
  }
  const emailBodies = Array.from(
    lastMessage.querySelectorAll("blockquote.gmail_quote > div:first-child")
  );
  const emailHeaders = lastMessage.querySelectorAll(
    "div.gmail_attr:has(+blockquote.gmail_quote)"
  );

  const parsedEmails = emailBodies.map((body, index) => ({
    body: html2md(body.innerHTML),
    header: /** @type {string} */ (emailHeaders[index]?.textContent),
  }));

  /** @type {null | HTMLElement} */
  let mainMessageBodyElement = lastMessage;
  while (
    mainMessageBodyElement?.querySelector?.("div.gmail_quote, blockquote")
  ) {
    mainMessageBodyElement = /** @type {HTMLElement} */ (
      mainMessageBodyElement.firstChild
    );
  }

  const mainMessageDate =
    lastMessage.parentElement?.parentElement?.children[0]?.querySelector(
      "table > tbody > tr > td:nth-child(2)"
    )?.textContent;
  const sender = lastMessageView.getSender();
  if (!mainMessageDate) {
    console.error("Could not find main message date", lastMessage);
    throw new Error("Could not find main message date");
  }
  const mainMessageBodyText =
    mainMessageBodyElement instanceof Text
      ? mainMessageBodyElement.textContent
      : /** @type {HTMLElement} */ (mainMessageBodyElement).innerHTML;

  if (!mainMessageBodyText) {
    console.error("Could not find main message body text (4)", lastMessage);
    throw new Error("Could not find main message body text (4)");
  }

  parsedEmails.unshift({
    body: html2md(mainMessageBodyText),
    header: `On ${mainMessageDate} ${sender.name} <${sender.emailAddress}> wrote:`,
  });
  const thread = {
    subject: threadView.getSubject(),
    emails: parsedEmails,
  };
  return thread;
};
