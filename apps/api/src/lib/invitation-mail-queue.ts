import {
  sendInvitationEmail,
  type SendInvitationEmailInput,
} from "./invitation-mailer.js";

type QueueItem = SendInvitationEmailInput & {
  attempt: number;
};

const queue: QueueItem[] = [];
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1_000, 5_000, 15_000];

let isProcessing = false;
const pendingRetryTimeouts = new Set<ReturnType<typeof setTimeout>>();

export function enqueueInvitationEmail(input: SendInvitationEmailInput): void {
  queue.push({ ...input, attempt: 0 });
  scheduleProcess();
}

export function resetInvitationMailQueue(): void {
  queue.length = 0;
  for (const timeoutId of pendingRetryTimeouts) {
    clearTimeout(timeoutId);
  }
  pendingRetryTimeouts.clear();
}

function scheduleProcess(): void {
  if (isProcessing || queue.length === 0) {
    return;
  }
  isProcessing = true;
  setImmediate(processNext);
}

function scheduleRetry(item: QueueItem, delay: number): void {
  const timeoutId = setTimeout(() => {
    pendingRetryTimeouts.delete(timeoutId);
    queue.push(item);
    scheduleProcess();
  }, delay);
  pendingRetryTimeouts.add(timeoutId);
}

async function processNext(): Promise<void> {
  const item = queue.shift();
  if (item === undefined) {
    isProcessing = false;
    return;
  }

  try {
    await sendInvitationEmail(item);
  } catch (error) {
    if (item.attempt < MAX_RETRIES) {
      const delay =
        RETRY_DELAYS_MS[item.attempt] ??
        RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      scheduleRetry({ ...item, attempt: item.attempt + 1 }, delay);
    } else {
      // TODO: デッドレターキューまたはアラートに送る
      console.error("Failed to send invitation email after retries", {
        organizationId: item.organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } finally {
    isProcessing = false;
    scheduleProcess();
  }
}
