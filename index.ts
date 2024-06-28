// Import statements
import StreamMessage from "./protocol/StreamMessage";
import StreamPair from "./protocol/StreamPair";
import RegisterPhoneRelay from "./protocol/RegisterPhoneRelay";
import RegisterPhoneRelayResponse from "./protocol/RegisterPhoneRelayResponse";
import ExecuteData, { type ActionType } from "./protocol/ExecuteData";
import LinkData from "./protocol/_LinkData";
import { StreamingJsonParser } from "./stream";

const headers = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
  Referer: "https://messages.google.com/",
  "X-User-Agent": "grpc-web-javascript/0.1",
  "X-Goog-Api-Key": "AIzaSyCA4RsOZUFrm9whhtGosPlJLmVPnfSHKz8",
};
type EventType = "unknown" | "gaia" | "pair" | "data";

function parseEventType(type: number): EventType {
  const eventTypes: Record<number, EventType> = {
    0: "unknown",
    7: "gaia",
    14: "pair",
    19: "data",
  };
  return eventTypes[type] || "unknown";
}

async function registerPhoneRelay(publicKey: Uint8Array) {
  const input = RegisterPhoneRelay({ data: { ecdsaKeys: { key: publicKey } } });
  const response = await fetch(
    "https://instantmessaging-pa.googleapis.com/$rpc/google.internal.communications.instantmessaging.v1.Pairing/RegisterPhoneRelay",
    {
      headers: {
        ...headers,
        "Content-Type": "application/x-protobuf",
      },
      body: input,
      method: "POST",
    }
  );
  return RegisterPhoneRelayResponse(
    new Uint8Array(await response.arrayBuffer())
  );
}

async function execute(
  mobile: { userId: number; sourceId: string; network: string },
  message: { action: ActionType; data: Uint8Array },
  authKey: Uint8Array
) {
  const id = crypto.randomUUID();
  const messageBuf = ExecuteData({
    requestId: id,
    action: message.action,
    data: message.data,
    sessionId: id,
  });
  const messageB64 = btoa(
    messageBuf.reduce((a, b) => a + String.fromCharCode(b), "")
  );
  const input = JSON.stringify([
    [mobile.userId, mobile.sourceId, mobile.network],
    [
      id,
      19,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      messageB64,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      [null, 2],
    ],
    [
      id,
      null,
      null,
      null,
      null,
      btoa(authKey.reduce((a, b) => a + String.fromCharCode(b), "")),
      [null, null, 2024, 6, 25, null, 4, null, 6],
    ],
  ]);

  const response = await fetch(
    "https://instantmessaging-pa.googleapis.com/$rpc/google.internal.communications.instantmessaging.v1.Messaging/SendMessage",
    {
      headers: {
        ...headers,
        "Content-Type": "application/json+protobuf",
      },
      body: input,
      method: "POST",
    }
  );
  return await response.text();
}

async function receiveMessages(authKey: Uint8Array): Promise<{
  paired: {
    mobile: { userId: number; sourceId: string; network: string };
    authKey: { key: Uint8Array; TTL: number };
    browser: { userId: number; sourceId: string; network: string };
  };
}> {
  const input = JSON.stringify([
    [
      crypto.randomUUID(),
      null,
      null,
      null,
      null,
      btoa(authKey.reduce((a, b) => a + String.fromCharCode(b), "")),
      [null, null, 2024, 6, 25, null, 4, null, 6],
    ],
    null,
    null,
    [],
  ]);

  const controller = new AbortController();
  const response = await fetch(
    "https://instantmessaging-pa.googleapis.com/$rpc/google.internal.communications.instantmessaging.v1.Messaging/ReceiveMessages",
    {
      headers: {
        ...headers,
        "Content-Type": "application/json+protobuf",
      },
      body: input,
      method: "POST",
      signal: controller.signal,
    }
  );

  const reader = response.body!.getReader();
  const decoder = new TextDecoder("utf-8");
  const parser = new StreamingJsonParser();

  return new Promise((resolve, reject) => {
    parser.onJson = async (x) => {
      console.log("received", x.map(Boolean));
      const [, data, heartbeat, ack, start] = x;
      if (data) {
        console.log();
        console.log("event type:", parseEventType(data[1]));

        const decodedData = atob(data[11]);
        const dataArray = new Uint8Array(decodedData.length);
        for (let i = 0; i < decodedData.length; i++) {
          dataArray[i] = decodedData.charCodeAt(i);
        }

        if (data[1] === 14) {
          const { paired } = StreamPair(dataArray);
          controller.abort();
          resolve({ paired });
        } else {
          const { encryptedData } = StreamMessage(dataArray);
          const signature = encryptedData.slice(-32);
          const signed = encryptedData.slice(0, -32);
          const iv = encryptedData.slice(-48, -32);
          const encryptedBody = encryptedData.slice(0, -48);

          const hmacKeyObj = await crypto.subtle.importKey(
            "raw",
            hmacKey,
            { name: "HMAC", hash: { name: "SHA-256" } },
            false,
            ["sign"]
          );

          const mac = await crypto.subtle.sign("HMAC", hmacKeyObj, signed);

          console.log("VERIFICATION:", signature, mac);

          const aesKeyObj = await crypto.subtle.importKey(
            "raw",
            aesKey,
            { name: "AES-CTR", length: 256 },
            false,
            ["decrypt"]
          );

          const decryptedData = await crypto.subtle.decrypt(
            { name: "AES-CTR", counter: iv, length: 128 },
            aesKeyObj,
            encryptedBody
          );
          console.log(
            "DECRYPTED:",
            btoa(
              new Uint8Array(decryptedData).reduce(
                (a, b) => a + String.fromCharCode(b),
                ""
              )
            )
          );
        }
      }
    };

    const processStream = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          parser.parseChunk(chunk);
        }
      } catch (e) {
        if (e.name !== "AbortError") {
          reject(e);
        }
      }
    };

    processStream();
  });
}

// Generate keys
const keyPair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"]
);
const publicKey = await crypto.subtle
  .exportKey("spki", keyPair.publicKey)
  .then((k) => new Uint8Array(k));
const aesKey = crypto.getRandomValues(new Uint8Array(32));
const hmacKey = crypto.getRandomValues(new Uint8Array(32));

// Register phone relay
const { pairingKey, authKey: authKeyTemp } = await registerPhoneRelay(
  publicKey
);

// Generate link data
const linkBuf = LinkData({ pairingKey, aesKey, hmacKey });
const linkB64 = btoa(linkBuf.reduce((a, b) => a + String.fromCharCode(b), ""));
console.log(
  `https://support.google.com/messages/?p=web_computer#?c=${linkB64}`
);

// Receive messages and handle the response
const { paired } = await receiveMessages(authKeyTemp.key);
const { authKey } = paired;
console.log("Pairing completed:", paired);

execute(paired.mobile, { action: 16, data: new Uint8Array(0) }, authKey.key);
await receiveMessages(paired.authKey.key);
console.log("Messaging completed");
