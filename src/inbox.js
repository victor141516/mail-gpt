// @ts-check
import * as InboxSDK from "@inboxsdk/core";

const MAIL_GPT_SUGGESTIONS_WRAPPER_ELEMENT_ID = "mail-gpt-suggestions_wrapper";
const MAIL_GPT_SUGGESTIONS_BUTTONS_ELEMENT_ID = "mail-gpt-suggestions_buttons";
const MAIL_GPT_SUGGESTIONS_LOADING_INDICATOR_ELEMENT_ID =
  "mail-gpt-suggestions_loading-indicator";
const MAIL_GPT_SUGGESTIONS_SUGGESTION_HINT_ELEMENT_ID =
  "mail-gpt-suggestions_suggestion-hint";

/** @type {InboxSDK.InboxSDK} */
let _sdk;

export const getSdk = async () => {
  if (!_sdk) {
    _sdk = await InboxSDK.load(2, "Hello World!", undefined);
  }
  return _sdk;
};

export const getUser = async () => {
  const retryable = async (retries = 3) => {
    if (retries === 0) {
      throw new Error("getUser failed");
    }
    const sdk = await getSdk();
    /** @type {string|undefined} */
    let name = "",
      email = "";
    try {
      email = sdk.User.getEmailAddress();
      const personalDetails = await sdk.User.getPersonDetails(email);
      name = personalDetails?.fullName;
    } catch (e) {
      console.log(e);
      await new Promise((resolve) => setTimeout(resolve, 100));
      return retryable(retries - 1);
    }
    return { email, name };
  };
  return retryable();
};

/** @param {{onCreate: (composeView: InboxSDK.ComposeView) => void, onDestroy?: () => void}} param */
export const onCompose = async ({ onCreate, onDestroy }) => {
  const sdk = await getSdk();
  sdk.Compose.registerComposeViewHandler((cv) => {
    cv.getBodyElement().parentElement?.insertAdjacentHTML(
      "beforebegin",
      `<div id="${MAIL_GPT_SUGGESTIONS_WRAPPER_ELEMENT_ID}">
          <form id="${MAIL_GPT_SUGGESTIONS_SUGGESTION_HINT_ELEMENT_ID}"></form>
          <div id="${MAIL_GPT_SUGGESTIONS_BUTTONS_ELEMENT_ID}"></div>
          <div id="${MAIL_GPT_SUGGESTIONS_LOADING_INDICATOR_ELEMENT_ID}"></div>
        </div>`
    );
    onCreate(cv);
    cv.on("destroy", () => onDestroy?.());
  });
};

/** @param {{onCreate: (threadView: InboxSDK.ThreadView) => void, onDestroy?: () => void}} param */
export const onThread = async ({ onCreate, onDestroy }) => {
  const sdk = await getSdk();
  sdk.Conversations.registerThreadViewHandler((tv) => {
    onCreate(tv);
    tv.on("destroy", () => onDestroy?.());
  });
};

/** @param {{description: string, body: string, onClick: () => void}} param */
export const insertButton = ({ description, body, onClick }) => {
  const button = document.createElement("button");
  button.innerText = description;
  button.addEventListener("click", () => onClick());
  const buttonContainer = document.getElementById(
    MAIL_GPT_SUGGESTIONS_BUTTONS_ELEMENT_ID
  );
  buttonContainer?.insertAdjacentElement("beforeend", button);
};

/** @param {boolean} isLoading */
export const setButtonsLoading = (isLoading) => {
  const indicatorContainer = document.getElementById(
    MAIL_GPT_SUGGESTIONS_LOADING_INDICATOR_ELEMENT_ID
  );
  if (isLoading) {
    const indicator = document.createElement("div");
    indicator.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><style>.spinner_qM83{animation:spinner_8HQG 1.05s infinite}.spinner_oXPr{animation-delay:.1s}.spinner_ZTLf{animation-delay:.2s}@keyframes spinner_8HQG{0%,57.14%{animation-timing-function:cubic-bezier(0.33,.66,.66,1);transform:translate(0)}28.57%{animation-timing-function:cubic-bezier(0.33,0,.66,.33);transform:translateY(-6px)}100%{transform:translate(0)}}</style><circle class="spinner_qM83" cx="4" cy="12" r="3"/><circle class="spinner_qM83 spinner_oXPr" cx="12" cy="12" r="3"/><circle class="spinner_qM83 spinner_ZTLf" cx="20" cy="12" r="3"/></svg>';
    indicatorContainer?.insertAdjacentElement("beforeend", indicator);
  } else {
    indicatorContainer?.childNodes.forEach((child) => child.remove());
  }
};

/** @param {{onSubmit?: (value: string) => void}} param */
export const insertSuggestionHintInput = ({ onSubmit } = {}) => {
  const label = document.createElement("label");
  label.innerHTML = "<span>Hint:</span>";
  const input = document.createElement("input");
  label.insertAdjacentElement("beforeend", input);
  const form = document.getElementById(
    MAIL_GPT_SUGGESTIONS_SUGGESTION_HINT_ELEMENT_ID
  );
  input.addEventListener("click", (event) => event.stopPropagation());
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit?.(input.value);
  });
  form?.insertAdjacentElement("beforeend", label);
};
