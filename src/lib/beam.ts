import { supabase } from "@/integrations/supabase/client";

/**
 * Direct device-to-device APK transfer over WebRTC.
 * Signalling rides on the realtime broadcast channel; the file bytes never
 * touch a server — when both devices sit on the same Wi-Fi the data channel
 * connects over the local network (host candidates), so it is as direct as
 * Wi-Fi Direct / Nearby Share, but works from laptops and TVs too.
 */

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] },
  ],
};

const CHUNK = 64 * 1024;

export type BeamHandle = { cancel: () => void };

export type BeamMeta = { name: string; size: number; appName: string };

export function makeBeamCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function channelFor(code: string) {
  return supabase.channel(`beam-${code}`, { config: { broadcast: { self: false } } });
}

/** Sender: waits for a receiver with this code, then pushes the file. */
export function beamSend(
  code: string,
  file: File,
  appName: string,
  cb: {
    onStatus: (s: string) => void;
    onProgress: (sent: number, total: number) => void;
    onDone: () => void;
    onError: (m: string) => void;
  },
): BeamHandle {
  const ch = channelFor(code);
  let pc: RTCPeerConnection | null = null;
  let cancelled = false;
  let started = false;

  const cleanup = () => {
    try { pc?.close(); } catch { /* noop */ }
    try { supabase.removeChannel(ch); } catch { /* noop */ }
  };

  const send = (event: string, payload: unknown) =>
    ch.send({ type: "broadcast", event, payload });

  async function start() {
    if (started || cancelled) return;
    started = true;
    cb.onStatus("Device found — connecting…");

    pc = new RTCPeerConnection(ICE);
    const dc = pc.createDataChannel("apk", { ordered: true });
    dc.binaryType = "arraybuffer";
    dc.bufferedAmountLowThreshold = 4 * CHUNK;

    pc.onicecandidate = (e) => {
      if (e.candidate) void send("ice", { from: "sender", candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === "failed") cb.onError("Connection failed. Try again on the same Wi-Fi.");
    };

    dc.onopen = async () => {
      cb.onStatus("Connected — sending APK…");
      const meta: BeamMeta = { name: file.name, size: file.size, appName };
      dc.send(JSON.stringify(meta));

      const buffer = await file.arrayBuffer();
      let offset = 0;
      while (offset < buffer.byteLength) {
        if (cancelled) return;
        if (dc.bufferedAmount > 8 * CHUNK) {
          await new Promise<void>((r) => {
            const h = () => { dc.removeEventListener("bufferedamountlow", h); r(); };
            dc.addEventListener("bufferedamountlow", h);
          });
          continue;
        }
        const slice = buffer.slice(offset, offset + CHUNK);
        dc.send(slice);
        offset += slice.byteLength;
        cb.onProgress(offset, buffer.byteLength);
      }
      dc.send("EOF");
    };

    dc.onclose = () => cleanup();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    void send("offer", { sdp: pc.localDescription });
  }

  ch.on("broadcast", { event: "hello" }, () => void start());
  ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
    if (!pc || pc.currentRemoteDescription) return;
    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
  });
  ch.on("broadcast", { event: "ice" }, async ({ payload }) => {
    if (payload.from === "sender" || !pc) return;
    try { await pc.addIceCandidate(payload.candidate); } catch { /* noop */ }
  });
  ch.on("broadcast", { event: "received" }, () => {
    cb.onStatus("Delivered — the other device is saving the APK.");
    cb.onDone();
    cleanup();
  });

  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") cb.onStatus("Waiting for the other device to open the link…");
    if (status === "CHANNEL_ERROR") cb.onError("Couldn't open the transfer channel.");
  });

  return {
    cancel: () => {
      cancelled = true;
      cleanup();
    },
  };
}

/** Receiver: joins the code and auto-saves the incoming file. */
export function beamReceive(
  code: string,
  cb: {
    onStatus: (s: string) => void;
    onProgress: (got: number, total: number) => void;
    onFile: (file: File, meta: BeamMeta) => void;
    onError: (m: string) => void;
  },
): BeamHandle {
  const ch = channelFor(code);
  let pc: RTCPeerConnection | null = null;

  const cleanup = () => {
    try { pc?.close(); } catch { /* noop */ }
    try { supabase.removeChannel(ch); } catch { /* noop */ }
  };

  const send = (event: string, payload: unknown) =>
    ch.send({ type: "broadcast", event, payload });

  ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
    if (pc) return;
    cb.onStatus("Sender found — connecting…");
    pc = new RTCPeerConnection(ICE);

    let meta: BeamMeta | null = null;
    const chunks: ArrayBuffer[] = [];
    let got = 0;

    pc.onicecandidate = (e) => {
      if (e.candidate) void send("ice", { from: "receiver", candidate: e.candidate.toJSON() });
    };
    pc.ondatachannel = (ev) => {
      const dc = ev.channel;
      dc.binaryType = "arraybuffer";
      dc.onmessage = (m) => {
        if (typeof m.data === "string") {
          if (m.data === "EOF") {
            if (!meta) return;
            const file = new File([new Blob(chunks)], meta.name, {
              type: "application/vnd.android.package-archive",
            });
            void send("received", {});
            cb.onFile(file, meta);
            return;
          }
          meta = JSON.parse(m.data) as BeamMeta;
          cb.onStatus(`Receiving ${meta.name}…`);
          return;
        }
        chunks.push(m.data as ArrayBuffer);
        got += (m.data as ArrayBuffer).byteLength;
        cb.onProgress(got, meta?.size ?? 0);
      };
    };
    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === "failed") cb.onError("Connection failed. Ask the sender to retry.");
    };

    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    void send("answer", { sdp: pc.localDescription });
  });

  ch.on("broadcast", { event: "ice" }, async ({ payload }) => {
    if (payload.from === "receiver" || !pc) return;
    try { await pc.addIceCandidate(payload.candidate); } catch { /* noop */ }
  });

  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      cb.onStatus("Ready — waiting for the sender…");
      void send("hello", {});
      const ping = setInterval(() => void send("hello", {}), 3000);
      setTimeout(() => clearInterval(ping), 60_000);
    }
    if (status === "CHANNEL_ERROR") cb.onError("Couldn't open the transfer channel.");
  });

  return { cancel: cleanup };
}
