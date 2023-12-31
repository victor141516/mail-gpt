// @ts-check

import { fetchEventSource } from "@microsoft/fetch-event-source";
import EventEmitter from "events";
/** @typedef {import('@microsoft/fetch-event-source').EventSourceMessage} EventSourceMessage */

const SYSTEM_PROMPT_WITHOUT_HINT = `You will receive an email thread formatted as JSON with the following structure:
{subject: string, user: {name: string, address: string}, emails: Array<{header: "\${date} \${from}", body: string}>}
The array of emails are sorted by date (index 0 is the oldest email, last index is the latest).
You must write between 4 and 5 replies based on the previous emails.
You must also provide a very short (less than 6 words) description for each of your replies. The email will be sent by the user you\'ll receive in the message, so use it to know which perspective you must use.
Use Markdown format for the body of your responses.
Use JSON LINES for your response using this format:
{"description": string, "body": string}
Always use the same language used in the emails you receive (i.e. if the emails you receive are written in English, then you will use English to write your reply. if the emails you receive are written in Spanish, then you will use Spanish to write your reply.).`;

const SYSTEM_PROMPT_WITH_HINT = `You will receive an email thread formatted as JSON with the following structure:
{subject: string, user: {name: string, address: string}, emails: Array<{header: "\${date} \${from}", body: string}>, hint: string}
The array of emails are sorted by date (index 0 is the oldest email, last index is the latest).
You must write ONLY ONE (1) reply based on the previous emails.
You MUST use the hint field as a base to generate your response.
You must also provide a very short (less than 6 words) description for the reply. The email will be sent by the user you\'ll receive in the message, so use it to know which perspective you must use.
Use Markdown format for the body of your response.
Use JSON LINES for your response using this format:
{"description": string, "body": string}
ALWAYS escape newlines (\\n) and the double quotes in the body of your response.
Always use the same language used in the emails you receive (i.e. if the emails you receive are written in English, then you will use English to write your reply. if the emails you receive are written in Spanish, then you will use Spanish to write your reply.).`;

/**
 * @typedef {{
 *   "id": string,
 *   "object": "chat.completion.chunk",
 *   "created": number,
 *   "model": "gpt-4-0613" | "gpt-3.5-turbo",
 *   "choices": [
 *     {
 *       "index": number,
 *       "delta": {
 *         "role": "assistant",
 *         "content": string
 *       },
 *       "finish_reason": null
 *     }
 *   ]
 * }} GPTEvent
 */

/**
 * @typedef {{
 *  subject: string,
 *  user: {name: string, address: string},
 *  emails: Array<{header: string, body: string}>,
 *  hint?: string
 * }} GPTPayload
 */

/** @typedef {{description: string, body: string}} SuggestionItem */

/**
 * @template T
 * @param {string} text
 * @returns {Array<T>}
 */
function partialParseJsonLines(text) {
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (e) {}
    })
    .filter(Boolean);
}

/** @param {{apiKey: string, body: GPTPayload}} param0 */
function getRequestParams({ apiKey, body }) {
  return {
    headers: {
      accept: "*/*",
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4", //"gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: body.hint
            ? SYSTEM_PROMPT_WITH_HINT
            : SYSTEM_PROMPT_WITHOUT_HINT,
        },
        {
          role: "user",
          content: JSON.stringify(body, null, 2),
        },
      ],
      stream: true,
    }),
    method: "POST",
  };
}

/** @param {{apiKey: string, body: GPTPayload}} param0 */
export async function* request({ apiKey, body }) {
  /** @type {Array<SuggestionItem>} */
  let responseParsed = [];
  let responseText = "";
  let done = false;
  const eventEmitter = new EventEmitter();

  const doRequest = () =>
    fetchEventSource("https://api.openai.com/v1/chat/completions", {
      ...getRequestParams({ apiKey, body }),
      onmessage(ev) {
        eventEmitter.emit("message", ev);
      },
      onerror(err) {
        eventEmitter.emit("error", err);
      },
      onclose() {
        eventEmitter.emit("done");
      },
    });

  /** @type {(ev: EventSourceMessage, cb: ((payload: SuggestionItem | null) => void)) => void} */
  const onMessage = (ev, cb) => {
    if (ev.data === "[DONE]") {
      eventEmitter.emit("done");
      resolve(null);
      return;
    }
    const data = /** @type {GPTEvent} */ (JSON.parse(ev.data));
    responseText += data.choices[0].delta.content ?? "";

    const newItems =
      /** @type {typeof partialParseJsonLines<SuggestionItem>} */ (
        partialParseJsonLines
      )(responseText);

    if (newItems.length > responseParsed.length) {
      responseParsed = newItems;
      const last = /** @type {(typeof responseParsed)[number]} */ (
        responseParsed.at(-1)
      );
      cb(last);
    }
  };

  /** @type {(value: SuggestionItem | null) => void} */
  let resolve;
  /** @type {Promise<SuggestionItem | null>} */
  let promise;
  const resetPromise = () => {
    promise = new Promise((r) => {
      resolve = r;
    });
  };
  resetPromise();
  eventEmitter.on("message", (event) => onMessage(event, resolve));
  eventEmitter.on("done", () => {
    done = true;
  });
  const request = doRequest();

  while (!done) {
    // @ts-ignore
    const value = await promise;
    if (value !== null) {
      yield value;
    }
    resetPromise();
  }
  await request;
}

/** @param {number} nofSuggestions */
export async function* requestMock(nofSuggestions) {
  for (let i = 0; i < nofSuggestions; i++) {
    yield new Promise((r) =>
      setTimeout(
        () =>
          r({
            description: "msg msg msg msg msg msg msg msg" + i,
            body: "body" + i,
          }),
        500
      )
    );
  }
}
