#!/usr/bin/env python3
"""
yamnet_uploader.py  —  YAMNet Raspberry Pi Uploader
=====================================================
Runs YAMNet inference on continuous microphone audio and uploads
dangerous-event results to the elderly-safety-monitor web platform
via its tRPC HTTP API.

Requirements
------------
    pip install numpy sounddevice requests tflite-runtime

Quick start
-----------
    python3 yamnet_uploader.py \
        --device-id  rpi-001 \
        --api-token  116b9075617e5a0f5a2591ca967d93e68ba321063e5d03d1773a3fd53202d470 \
        --server-url https://eldersafe-fv6io3sc.manus.space

Run without a real microphone (demo / CI test)
-----------------------------------------------
    python3 yamnet_uploader.py --demo
"""

import argparse
import base64
import io
import json
import logging
import sys
import time
import wave
from datetime import datetime
from pathlib import Path

import numpy as np
import requests

# ── optional imports ──────────────────────────────────────────────────────────
try:
    import sounddevice as sd
    HAS_SOUNDDEVICE = True
except ImportError:
    HAS_SOUNDDEVICE = False

try:
    import tflite_runtime.interpreter as tflite
    HAS_TFLITE = True
except ImportError:
    try:
        import tensorflow as tf
        tflite = tf.lite
        HAS_TFLITE = True
    except ImportError:
        HAS_TFLITE = False

# =============================================================================
# YAMNet class-id → event-type mapping  (matches server-side logic)
# =============================================================================

DANGER_CLASS_IDS: set[int] = {
    6, 7, 9, 11, 19, 20, 22, 33, 39, 42,
    300, 301, 310, 315, 316, 317, 390, 393, 394, 399, 420,
}

CLASS_TO_EVENT_TYPE: dict[int, str] = {
    6: "scream", 7: "scream", 9: "scream", 11: "scream",
    19: "scream", 20: "scream", 22: "scream",
    33: "cough", 39: "cough", 42: "cough",
    300: "fall", 301: "fall", 310: "fall", 315: "fall", 316: "fall",
    317: "moan", 390: "moan", 393: "moan", 394: "moan", 399: "moan",
    420: "scream",
}

# YAMNet 521 class names (abbreviated — only the dangerous ones matter here)
YAMNET_CLASS_NAMES: dict[int, str] = {
    6: "Screaming", 7: "Crying, sobbing", 9: "Whimper", 11: "Shout",
    19: "Wail, moan", 20: "Crying", 22: "Shriek",
    33: "Cough", 39: "Sneeze", 42: "Throat clearing",
    300: "Thud, impact", 301: "Bang", 310: "Crash", 315: "Thump, bump",
    316: "Slam", 317: "Groan", 390: "Moan", 393: "Grunt", 394: "Groan",
    399: "Whimper", 420: "Alarm",
}

# =============================================================================
# Configuration defaults
# =============================================================================

SAMPLE_RATE        = 16_000   # Hz  (YAMNet requirement)
CHUNK_DURATION     = 0.975    # seconds per inference window
CHUNK_SAMPLES      = int(SAMPLE_RATE * CHUNK_DURATION)
HEARTBEAT_INTERVAL = 30       # seconds between heartbeats
MODEL_VERSION      = "yamnet_v1"

# =============================================================================
# Logging
# =============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("yamnet_uploader.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("yamnet_uploader")

# =============================================================================
# tRPC HTTP helpers
# =============================================================================

def trpc_query(server_url: str, procedure: str, input_data: dict) -> dict:
    """Call a tRPC query (GET)."""
    encoded = json.dumps({"0": {"json": input_data}})
    url = f"{server_url}/api/trpc/{procedure}"
    resp = requests.get(url, params={"batch": "1", "input": encoded}, timeout=10)
    resp.raise_for_status()
    body = resp.json()
    return body[0]["result"]["data"]["json"]


def trpc_mutation(server_url: str, procedure: str, input_data: dict) -> dict:
    """Call a tRPC mutation (POST)."""
    url = f"{server_url}/api/trpc/{procedure}?batch=1"
    payload = {"0": {"json": input_data}}
    resp = requests.post(url, json=payload, timeout=15)
    resp.raise_for_status()
    body = resp.json()
    return body[0]["result"]["data"]["json"]

# =============================================================================
# Heartbeat
# =============================================================================

def send_heartbeat(server_url: str, device_id: str, api_token: str,
                   cpu_temp: float | None = None) -> dict | None:
    """Send a heartbeat and return the server config."""
    status: dict = {"model_version": MODEL_VERSION}
    if cpu_temp is not None:
        status["cpu_temp"] = cpu_temp

    try:
        result = trpc_mutation(server_url, "raspberryPi.heartbeat", {
            "device_id": device_id,
            "api_token": api_token,
            "status": status,
        })
        log.info("Heartbeat OK  server_time=%s", result.get("server_time"))
        return result.get("config")
    except Exception as exc:
        log.warning("Heartbeat failed: %s", exc)
        return None

# =============================================================================
# CPU temperature (Raspberry Pi only)
# =============================================================================

def read_cpu_temp() -> float | None:
    p = Path("/sys/class/thermal/thermal_zone0/temp")
    try:
        return int(p.read_text()) / 1000.0
    except Exception:
        return None

# =============================================================================
# Audio recording
# =============================================================================

def record_chunk(device_index: int | None = None) -> np.ndarray:
    """Record one CHUNK_DURATION window from the microphone."""
    if not HAS_SOUNDDEVICE:
        raise RuntimeError("sounddevice not installed")
    audio = sd.rec(
        CHUNK_SAMPLES,
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype="float32",
        device=device_index,
    )
    sd.wait()
    return audio.flatten()


def audio_to_wav_base64(audio: np.ndarray) -> str:
    """Encode float32 audio array as a base64-encoded WAV string."""
    pcm = (audio * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm.tobytes())
    return base64.b64encode(buf.getvalue()).decode()

# =============================================================================
# YAMNet inference
# =============================================================================

def load_yamnet(model_path: str = "yamnet.tflite"):
    """Load the YAMNet TFLite model."""
    if not HAS_TFLITE:
        raise RuntimeError("tflite_runtime (or tensorflow) not installed")
    interpreter = tflite.Interpreter(model_path=model_path)
    interpreter.allocate_tensors()
    inp = interpreter.get_input_details()
    out = interpreter.get_output_details()
    in_idx  = inp[0]["index"] if isinstance(inp, list) else inp["index"]
    out_idx = out[0]["index"] if isinstance(out, list) else out["index"]
    log.info("YAMNet loaded  input_shape=%s  output_shape=%s",
             (inp[0] if isinstance(inp, list) else inp)["shape"],
             (out[0] if isinstance(out, list) else out)["shape"])
    return interpreter, in_idx, out_idx


def run_inference(interpreter, in_idx: int, out_idx: int,
                  audio: np.ndarray) -> list[tuple[int, str, float]]:
    """
    Run YAMNet on one audio chunk.

    Returns a list of (class_id, class_name, confidence) sorted by confidence
    descending, top-10 only.
    """
    t0 = time.perf_counter()
    # YAMNet expects shape [num_samples] float32
    inp_tensor = audio.astype(np.float32)
    interpreter.resize_input_tensor(in_idx, inp_tensor.shape)
    interpreter.allocate_tensors()
    interpreter.set_tensor(in_idx, inp_tensor)
    interpreter.invoke()
    scores = interpreter.get_tensor(out_idx)   # shape: (1, 521) or (521,)
    scores = np.squeeze(scores)
    elapsed_ms = (time.perf_counter() - t0) * 1000

    top_indices = np.argsort(scores)[::-1][:10]
    results = []
    for idx in top_indices:
        cid   = int(idx)
        cname = YAMNET_CLASS_NAMES.get(cid, f"class_{cid}")
        conf  = float(scores[cid])
        results.append((cid, cname, conf))

    log.debug("Inference done in %.1f ms  top=%s conf=%.3f",
              elapsed_ms, results[0][1] if results else "?",
              results[0][2] if results else 0)
    return results, elapsed_ms

# =============================================================================
# Demo / synthetic inference (no microphone / no model)
# =============================================================================

def demo_inference() -> tuple[list[tuple[int, str, float]], float]:
    """
    Simulate a YAMNet inference result for testing without hardware.
    Cycles through a few dangerous and non-dangerous events.
    """
    import random
    demo_pool = [
        (300, "Thud, impact",   0.88),   # fall   — dangerous
        (6,   "Screaming",      0.92),   # scream — dangerous
        (33,  "Cough",          0.75),   # cough  — dangerous
        (317, "Groan",          0.65),   # moan   — dangerous
        (0,   "Speech",         0.55),   # normal — NOT dangerous
        (494, "Silence",        0.80),   # normal — NOT dangerous
    ]
    primary = random.choice(demo_pool)
    top10 = [primary] + [
        (random.randint(0, 520),
         YAMNET_CLASS_NAMES.get(random.randint(0, 520), "unknown"),
         round(random.uniform(0.01, 0.30), 4))
        for _ in range(9)
    ]
    elapsed_ms = round(random.uniform(8, 25), 1)
    return top10, elapsed_ms

# =============================================================================
# Upload one event
# =============================================================================

def upload_event(
    server_url: str,
    device_id: str,
    api_token: str,
    top_results: list[tuple[int, str, float]],
    elapsed_ms: float,
    audio: np.ndarray | None,
    confidence_threshold: float,
    danger_threshold: float,
) -> bool:
    """
    Upload one inference result to raspberryPi.uploadEvent.

    Returns True if the server accepted the event.
    """
    if not top_results:
        return False

    primary_class_id, primary_class_name, primary_confidence = top_results[0]

    # Only upload if confidence meets the threshold
    if primary_confidence < confidence_threshold:
        log.debug("Skipped (conf %.3f < threshold %.3f)",
                  primary_confidence, confidence_threshold)
        return False

    is_danger = (primary_class_id in DANGER_CLASS_IDS
                 and primary_confidence >= danger_threshold)

    top_labels = [
        {"class_id": cid, "class_name": cname, "confidence": round(conf, 4)}
        for cid, cname, conf in top_results
    ]

    rms_volume = float(np.sqrt(np.mean(audio ** 2))) if audio is not None else None

    payload: dict = {
        "device_id":           device_id,
        "api_token":           api_token,
        "timestamp":           int(time.time() * 1000),
        "primary_class_id":    primary_class_id,
        "primary_class_name":  primary_class_name,
        "primary_confidence":  round(primary_confidence, 4),
        "is_danger":           is_danger,
        "top_labels":          top_labels,
        "processing_time_ms":  round(elapsed_ms, 1),
        "model_version":       MODEL_VERSION,
    }

    if rms_volume is not None:
        payload["rms_volume"] = round(rms_volume, 6)

    if audio is not None:
        try:
            payload["audio_base64"]  = audio_to_wav_base64(audio)
            payload["audio_duration"] = round(len(audio) / SAMPLE_RATE, 3)
        except Exception as exc:
            log.warning("Audio encoding failed: %s", exc)

    try:
        result = trpc_mutation(server_url, "raspberryPi.uploadEvent", payload)
        level = "DANGER" if is_danger else "normal"
        log.info(
            "[%s] %s  conf=%.1f%%  alarm_created=%s  danger_level=%s",
            level,
            primary_class_name,
            primary_confidence * 100,
            result.get("alarm_created"),
            result.get("danger_level"),
        )
        return True
    except requests.HTTPError as exc:
        log.error("Upload HTTP error %s: %s", exc.response.status_code,
                  exc.response.text[:200])
        return False
    except Exception as exc:
        log.error("Upload failed: %s", exc)
        return False

# =============================================================================
# Main loop
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="YAMNet Raspberry Pi Uploader — streams audio events to the web platform"
    )
    parser.add_argument("--device-id",   default="rpi-001",
                        help="Device ID registered on the web platform (default: rpi-001)")
    parser.add_argument("--api-token",   default="",
                        help="API token obtained from the web platform")
    parser.add_argument("--server-url",  default="https://eldersafe-fv6io3sc.manus.space",
                        help="Web platform base URL")
    parser.add_argument("--model",       default="yamnet.tflite",
                        help="Path to yamnet.tflite model file")
    parser.add_argument("--mic-device",  type=int, default=None,
                        help="sounddevice device index (omit for system default)")
    parser.add_argument("--conf-threshold", type=float, default=0.5,
                        help="Minimum confidence to upload any event (default: 0.5)")
    parser.add_argument("--danger-threshold", type=float, default=0.65,
                        help="Minimum confidence to mark event as dangerous (default: 0.65)")
    parser.add_argument("--demo",        action="store_true",
                        help="Run in demo mode (no microphone, no model required)")
    parser.add_argument("--loop-delay",  type=float, default=0.5,
                        help="Seconds between inference loops (default: 0.5)")
    args = parser.parse_args()

    # ── validate token ────────────────────────────────────────────────────────
    if not args.api_token:
        log.error("--api-token is required. Get it from the web platform > Device Management.")
        sys.exit(1)

    log.info("=" * 60)
    log.info("YAMNet Uploader starting")
    log.info("  device_id  : %s", args.device_id)
    log.info("  server_url : %s", args.server_url)
    log.info("  demo mode  : %s", args.demo)
    log.info("=" * 60)

    # ── initial heartbeat ─────────────────────────────────────────────────────
    config = send_heartbeat(args.server_url, args.device_id, args.api_token)
    if config:
        args.conf_threshold   = config.get("confidence_threshold", args.conf_threshold)
        args.danger_threshold = config.get("danger_threshold",     args.danger_threshold)
        log.info("Server config applied: conf_threshold=%.2f  danger_threshold=%.2f",
                 args.conf_threshold, args.danger_threshold)

    # ── load model (unless demo) ──────────────────────────────────────────────
    interpreter = in_idx = out_idx = None
    if not args.demo:
        if not HAS_TFLITE:
            log.error("tflite_runtime not installed. Run:  pip install tflite-runtime")
            sys.exit(1)
        if not Path(args.model).exists():
            log.error("Model file not found: %s", args.model)
            log.error("Download from: https://tfhub.dev/google/lite-model/yamnet/classification/tflite/1")
            sys.exit(1)
        interpreter, in_idx, out_idx = load_yamnet(args.model)

        if not HAS_SOUNDDEVICE:
            log.error("sounddevice not installed. Run:  pip install sounddevice")
            sys.exit(1)

    # ── main loop ─────────────────────────────────────────────────────────────
    last_heartbeat = time.time()
    iteration      = 0

    log.info("Listening... Press Ctrl+C to stop.")

    try:
        while True:
            iteration += 1

            # periodic heartbeat
            if time.time() - last_heartbeat >= HEARTBEAT_INTERVAL:
                cpu_temp = read_cpu_temp()
                config = send_heartbeat(args.server_url, args.device_id,
                                        args.api_token, cpu_temp)
                if config:
                    args.conf_threshold   = config.get("confidence_threshold", args.conf_threshold)
                    args.danger_threshold = config.get("danger_threshold",     args.danger_threshold)
                last_heartbeat = time.time()

            # record + infer
            audio = None
            if args.demo:
                top_results, elapsed_ms = demo_inference()
                time.sleep(0.5)   # simulate recording time
            else:
                try:
                    audio = record_chunk(args.mic_device)
                except Exception as exc:
                    log.error("Recording error: %s", exc)
                    time.sleep(1)
                    continue

                top_results, elapsed_ms = run_inference(
                    interpreter, in_idx, out_idx, audio
                )

            # log top result
            if top_results:
                cid, cname, conf = top_results[0]
                danger_flag = "*** DANGER ***" if cid in DANGER_CLASS_IDS else ""
                log.info("[%04d] %-30s conf=%.1f%%  %s",
                         iteration, cname, conf * 100, danger_flag)

            # upload
            upload_event(
                server_url=args.server_url,
                device_id=args.device_id,
                api_token=args.api_token,
                top_results=top_results,
                elapsed_ms=elapsed_ms,
                audio=audio,
                confidence_threshold=args.conf_threshold,
                danger_threshold=args.danger_threshold,
            )

            time.sleep(args.loop_delay)

    except KeyboardInterrupt:
        log.info("Stopped by user after %d iterations.", iteration)


if __name__ == "__main__":
    main()
