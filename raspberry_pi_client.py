#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Raspberry Pi YAMNet Sound Monitoring Client
============================================
This program runs on a Raspberry Pi, captures audio using a ReSpeaker 4-Mic Array,
classifies audio events via the YAMNet model, and automatically uploads danger events
to the cloud server.

Hardware Requirements:
  - Raspberry Pi 4B (4GB RAM recommended)
  - ReSpeaker 4-Mic Array (device ID is usually 8)
  - Stable network connection

Software Dependencies:
  pip3 install sounddevice numpy requests tflite-runtime

Usage:
  python3 raspberry_pi_client.py --server-url https://your-server.com --device-id rpi-001 --api-token YOUR_TOKEN
"""

import argparse
import base64
import io
import json
import logging
import os
import signal
import struct
import sys
import time
import threading
import wave
from datetime import datetime

import numpy as np
import requests

# ============================================================================
# Configuration
# ============================================================================

# YAMNet model parameters
SAMPLE_RATE = 16000          # Sample rate 16kHz
AUDIO_SAMPLES = 15600        # YAMNet input length (0.975s)
RECORD_DURATION = 0.975      # Recording duration (seconds)
RMS_THRESHOLD = 0.03         # RMS volume threshold (filter background noise)
CHANNELS = 1                 # Mono (take first channel from 32)

# Danger class IDs (21 danger events out of YAMNet's 521 classes)
DANGER_CLASS_IDS = {
    6, 7, 9, 11, 19, 20, 22,        # Screaming / Cry for help
    33, 39, 42,                       # Coughing / Health
    300, 301, 310, 315, 316,          # Fall / Impact
    317, 390, 393, 394, 399,          # Moaning / Distress
    420,                              # Alarm
}

# Heartbeat interval
HEARTBEAT_INTERVAL = 60  # seconds

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('yamnet_client')


# ============================================================================
# YAMNet Model
# ============================================================================

class YAMNetModel:
    """YAMNet TensorFlow Lite model wrapper"""

    def __init__(self, model_path='yamnet.tflite', class_map_path='yamnet_class_map.csv'):
        self.model_path = model_path
        self.class_map_path = class_map_path
        self.interpreter = None
        self.class_names = []
        self._load_model()
        self._load_class_map()

    def _load_model(self):
        """Load TFLite model"""
        try:
            import tflite_runtime.interpreter as tflite
            self.interpreter = tflite.Interpreter(model_path=self.model_path)
            logger.info(f"YAMNet model loaded: {self.model_path}")
        except ImportError:
            try:
                import tensorflow as tf
                self.interpreter = tf.lite.Interpreter(model_path=self.model_path)
                logger.info(f"YAMNet model loaded (TF): {self.model_path}")
            except ImportError:
                logger.error("Please install tflite-runtime or tensorflow")
                sys.exit(1)

        # Resize input tensor to [15600]
        input_details = self.interpreter.get_input_details()
        self.interpreter.resize_tensor_input(input_details[0]['index'], [AUDIO_SAMPLES])
        self.interpreter.allocate_tensors()

        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        logger.info(f"Input shape: {self.input_details[0]['shape']}")
        logger.info(f"Output count: {len(self.output_details)}")

    def _load_class_map(self):
        """Load class name mapping"""
        if os.path.exists(self.class_map_path):
            with open(self.class_map_path, 'r') as f:
                lines = f.readlines()
                # Skip header line
                for line in lines[1:]:
                    parts = line.strip().split(',', 2)
                    if len(parts) >= 3:
                        self.class_names.append(parts[2].strip('"'))
            logger.info(f"Class map loaded: {len(self.class_names)} classes")
        else:
            logger.warning(f"Class map not found: {self.class_map_path}")
            self.class_names = [f"Class_{i}" for i in range(521)]

    def predict(self, audio_data):
        """
        Run inference on audio data.

        Args:
            audio_data: numpy array, shape [15600], float32, range [-1, 1]

        Returns:
            scores: numpy array, shape [521], confidence for each class
        """
        audio_data = audio_data.astype(np.float32)
        if len(audio_data) < AUDIO_SAMPLES:
            audio_data = np.pad(audio_data, (0, AUDIO_SAMPLES - len(audio_data)))
        elif len(audio_data) > AUDIO_SAMPLES:
            audio_data = audio_data[:AUDIO_SAMPLES]

        self.interpreter.set_tensor(self.input_details[0]['index'], audio_data)
        self.interpreter.invoke()

        scores = self.interpreter.get_tensor(self.output_details[0]['index'])
        return scores.flatten()

    def get_top_labels(self, scores, top_k=5):
        """Get top_k labels with highest confidence"""
        top_indices = np.argsort(scores)[-top_k:][::-1]
        results = []
        for idx in top_indices:
            results.append({
                'class_id': int(idx),
                'class_name': self.class_names[idx] if idx < len(self.class_names) else f"Class_{idx}",
                'confidence': float(scores[idx]),
            })
        return results


# ============================================================================
# Audio Capture
# ============================================================================

class AudioCapture:
    """Audio capture handler"""

    def __init__(self, device_id=None, channels=32, sample_rate=SAMPLE_RATE):
        import sounddevice as sd
        self.sd = sd
        self.device_id = device_id
        self.channels = channels
        self.sample_rate = sample_rate

        if device_id is not None:
            sd.default.device = device_id
            logger.info(f"Using audio device ID: {device_id}")

    def record(self, duration=RECORD_DURATION):
        """
        Record a segment of audio.

        Returns:
            audio_data: numpy array, shape [samples], normalized to [-1, 1]
            rms: float, RMS volume level
        """
        samples = int(duration * self.sample_rate)
        try:
            audio = self.sd.rec(samples, samplerate=self.sample_rate,
                               channels=self.channels, dtype='float32')
            self.sd.wait()

            # Take first channel
            if audio.shape[1] > 1:
                audio = audio[:, 0]
            else:
                audio = audio.flatten()

            # Normalize
            max_val = np.max(np.abs(audio))
            if max_val > 0:
                audio = audio / max_val

            # Calculate RMS
            rms = float(np.sqrt(np.mean(audio ** 2)))

            return audio, rms
        except Exception as e:
            logger.error(f"Recording failed: {e}")
            return np.zeros(samples, dtype=np.float32), 0.0


# ============================================================================
# Server Communication
# ============================================================================

class ServerClient:
    """Client for communicating with the cloud server"""

    def __init__(self, server_url, device_id, api_token, timeout=10):
        self.server_url = server_url.rstrip('/')
        self.device_id = device_id
        self.api_token = api_token
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
        })

    def _trpc_url(self, procedure):
        """Build tRPC API URL"""
        return f"{self.server_url}/api/trpc/{procedure}"

    def _trpc_mutation(self, procedure, data):
        """Call tRPC mutation"""
        url = self._trpc_url(procedure)
        payload = {"json": data}
        try:
            resp = self.session.post(url, json=payload, timeout=self.timeout)
            if resp.status_code == 200:
                result = resp.json()
                return result.get('result', {}).get('data', {}).get('json', result)
            else:
                logger.error(f"API call failed [{procedure}]: {resp.status_code} {resp.text[:200]}")
                return None
        except requests.exceptions.Timeout:
            logger.error(f"API call timeout [{procedure}]")
            return None
        except requests.exceptions.ConnectionError:
            logger.error(f"Cannot connect to server [{procedure}]")
            return None
        except Exception as e:
            logger.error(f"API call error [{procedure}]: {e}")
            return None

    def _trpc_query(self, procedure, data):
        """Call tRPC query"""
        url = self._trpc_url(procedure)
        import urllib.parse
        input_json = json.dumps({"json": data})
        params = {"input": input_json}
        try:
            resp = self.session.get(url, params=params, timeout=self.timeout)
            if resp.status_code == 200:
                result = resp.json()
                return result.get('result', {}).get('data', {}).get('json', result)
            else:
                logger.error(f"API query failed [{procedure}]: {resp.status_code} {resp.text[:200]}")
                return None
        except Exception as e:
            logger.error(f"API query error [{procedure}]: {e}")
            return None

    def heartbeat(self, status=None):
        """Send heartbeat"""
        data = {
            "device_id": self.device_id,
            "api_token": self.api_token,
        }
        if status:
            data["status"] = status
        return self._trpc_mutation("raspberryPi.heartbeat", data)

    def upload_event(self, primary_class_id, primary_class_name, primary_confidence,
                     is_danger, top_labels=None, rms_volume=None,
                     processing_time_ms=None, model_version=None,
                     audio_data=None, audio_duration=None):
        """Upload sound event"""
        data = {
            "device_id": self.device_id,
            "api_token": self.api_token,
            "timestamp": int(time.time() * 1000),
            "primary_class_id": primary_class_id,
            "primary_class_name": primary_class_name,
            "primary_confidence": primary_confidence,
            "is_danger": is_danger,
        }

        if top_labels:
            data["top_labels"] = top_labels
        if rms_volume is not None:
            data["rms_volume"] = rms_volume
        if processing_time_ms is not None:
            data["processing_time_ms"] = processing_time_ms
        if model_version:
            data["model_version"] = model_version
        if audio_duration:
            data["audio_duration"] = audio_duration

        # Upload audio data for danger events
        if is_danger and audio_data is not None:
            try:
                audio_base64 = self._encode_audio_wav(audio_data)
                data["audio_base64"] = audio_base64
            except Exception as e:
                logger.error(f"Audio encoding failed: {e}")

        return self._trpc_mutation("raspberryPi.uploadEvent", data)

    def get_config(self):
        """Get device configuration"""
        data = {
            "device_id": self.device_id,
            "api_token": self.api_token,
        }
        return self._trpc_query("raspberryPi.getConfig", data)

    def _encode_audio_wav(self, audio_data, sample_rate=SAMPLE_RATE):
        """Encode audio data to Base64 WAV format"""
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(sample_rate)
            pcm_data = (audio_data * 32767).astype(np.int16)
            wf.writeframes(pcm_data.tobytes())
        return base64.b64encode(buf.getvalue()).decode('utf-8')


# ============================================================================
# Monitoring Loop
# ============================================================================

class MonitoringService:
    """Sound monitoring service"""

    def __init__(self, model, audio_capture, server_client, config=None):
        self.model = model
        self.audio = audio_capture
        self.server = server_client
        self.running = False
        self.config = config or {}

        # Update thresholds from server config
        self.rms_threshold = self.config.get('rms_threshold', RMS_THRESHOLD)
        self.danger_threshold = self.config.get('danger_threshold', 0.75)

        # Statistics
        self.total_detections = 0
        self.danger_detections = 0
        self.start_time = None

        # Heartbeat thread
        self.heartbeat_thread = None

    def start(self):
        """Start monitoring"""
        self.running = True
        self.start_time = time.time()

        # Start heartbeat thread
        self.heartbeat_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self.heartbeat_thread.start()

        logger.info("=" * 60)
        logger.info("Sound Monitoring Service STARTED")
        logger.info(f"  RMS threshold : {self.rms_threshold}")
        logger.info(f"  Danger thresh : {self.danger_threshold}")
        logger.info(f"  Sample rate   : {SAMPLE_RATE} Hz")
        logger.info(f"  Record length : {RECORD_DURATION} s")
        logger.info("=" * 60)

        try:
            self._monitoring_loop()
        except KeyboardInterrupt:
            logger.info("Interrupt received, stopping...")
        finally:
            self.stop()

    def stop(self):
        """Stop monitoring"""
        self.running = False
        elapsed = time.time() - self.start_time if self.start_time else 0
        logger.info("=" * 60)
        logger.info("Sound Monitoring Service STOPPED")
        logger.info(f"  Uptime          : {elapsed:.0f} s")
        logger.info(f"  Total detections: {self.total_detections}")
        logger.info(f"  Danger events   : {self.danger_detections}")
        logger.info("=" * 60)

    def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.running:
            try:
                # Record audio
                audio_data, rms = self.audio.record(RECORD_DURATION)

                # Volume bar display
                bar_len = int(rms * 200)
                bar = '#' * min(bar_len, 50)
                rms_str = f"Volume: {rms:.4f} |{bar:<50}|"

                # Check if above threshold
                if rms < self.rms_threshold:
                    # Quiet, skip inference
                    sys.stdout.write(f"\r{rms_str} [Quiet]")
                    sys.stdout.flush()
                    continue

                # Run YAMNet inference
                start_time = time.time()
                scores = self.model.predict(audio_data)
                processing_time = int((time.time() - start_time) * 1000)

                # Get Top-5 labels
                top_labels = self.model.get_top_labels(scores, top_k=5)
                primary = top_labels[0]

                # Check if danger event
                is_danger = primary['class_id'] in DANGER_CLASS_IDS
                self.total_detections += 1

                # Display result
                danger_flag = " *** DANGER! ***" if is_danger else ""
                print(f"\n{rms_str}")
                print(f"  Result: {primary['class_name']} "
                      f"(ID:{primary['class_id']}, "
                      f"Conf:{primary['confidence']:.2%}, "
                      f"Time:{processing_time}ms)"
                      f"{danger_flag}")

                # Print Top-5 labels
                if is_danger or primary['confidence'] > 0.5:
                    print(f"  Top-5:")
                    for i, lbl in enumerate(top_labels):
                        marker = " <--DANGER" if lbl['class_id'] in DANGER_CLASS_IDS else ""
                        print(f"    {i+1}. {lbl['class_name']:<30} {lbl['confidence']:.2%}{marker}")

                # Upload event to server
                if is_danger or primary['confidence'] > 0.5:
                    result = self.server.upload_event(
                        primary_class_id=primary['class_id'],
                        primary_class_name=primary['class_name'],
                        primary_confidence=primary['confidence'],
                        is_danger=is_danger,
                        top_labels=top_labels,
                        rms_volume=rms,
                        processing_time_ms=processing_time,
                        model_version="yamnet_v1",
                        audio_data=audio_data if is_danger else None,
                        audio_duration=RECORD_DURATION,
                    )

                    if result:
                        if is_danger:
                            self.danger_detections += 1
                            alarm_info = ""
                            if result.get('alarm_created'):
                                alarm_info = f" -> Alarm created (ID: {result.get('alarm_id')})"
                            print(f"  >>> Danger event uploaded!{alarm_info}")
                        else:
                            print(f"  >>> Event uploaded (confidence > 50%)")
                    else:
                        print(f"  >>> Upload failed, will retry next time")

            except Exception as e:
                logger.error(f"Monitoring loop error: {e}")
                time.sleep(1)

    def _heartbeat_loop(self):
        """Heartbeat loop"""
        while self.running:
            try:
                status = self._get_system_status()
                result = self.server.heartbeat(status)
                if result:
                    # Check for config updates
                    config = result.get('config', {})
                    if config:
                        new_rms = config.get('rms_threshold')
                        new_danger = config.get('danger_threshold')
                        if new_rms and new_rms != self.rms_threshold:
                            self.rms_threshold = new_rms
                            logger.info(f"RMS threshold updated: {new_rms}")
                        if new_danger and new_danger != self.danger_threshold:
                            self.danger_threshold = new_danger
                            logger.info(f"Danger threshold updated: {new_danger}")
                else:
                    logger.warning("Heartbeat failed")
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")

            # Wait for next heartbeat
            for _ in range(HEARTBEAT_INTERVAL):
                if not self.running:
                    break
                time.sleep(1)

    def _get_system_status(self):
        """Get Raspberry Pi system status"""
        status = {
            "model_version": "yamnet_v1",
        }

        # CPU temperature
        try:
            with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                temp = int(f.read().strip()) / 1000.0
                status['cpu_temp'] = temp
        except:
            pass

        # CPU load
        try:
            with open('/proc/loadavg', 'r') as f:
                load = float(f.read().split()[0])
                status['cpu_usage'] = load
        except:
            pass

        # System uptime
        try:
            with open('/proc/uptime', 'r') as f:
                uptime = float(f.read().split()[0])
                status['uptime'] = uptime
        except:
            pass

        return status


# ============================================================================
# CLI Entry Point
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Raspberry Pi YAMNet Sound Monitoring Client',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage
  python3 raspberry_pi_client.py \\
    --server-url https://eldersafe-fv6io3sc.manus.space \\
    --device-id rpi-001 \\
    --api-token YOUR_API_TOKEN

  # Specify audio device and model path
  python3 raspberry_pi_client.py \\
    --server-url https://eldersafe-fv6io3sc.manus.space \\
    --device-id rpi-001 \\
    --api-token YOUR_API_TOKEN \\
    --audio-device 8 \\
    --channels 32 \\
    --model-path ./yamnet.tflite \\
    --class-map ./yamnet_class_map.csv

  # Adjust thresholds
  python3 raspberry_pi_client.py \\
    --server-url https://eldersafe-fv6io3sc.manus.space \\
    --device-id rpi-001 \\
    --api-token YOUR_API_TOKEN \\
    --rms-threshold 0.02 \\
    --danger-threshold 0.6
        """
    )

    # Required arguments
    parser.add_argument('--server-url', required=True,
                        help='Cloud server URL (e.g. https://eldersafe-fv6io3sc.manus.space)')
    parser.add_argument('--device-id', required=True,
                        help='Device ID (e.g. rpi-001, must be registered on the web dashboard first)')
    parser.add_argument('--api-token', required=True,
                        help='Device API Token (obtained when registering the device)')

    # Audio parameters
    parser.add_argument('--audio-device', type=int, default=None,
                        help='Audio device ID (ReSpeaker is usually 8)')
    parser.add_argument('--channels', type=int, default=32,
                        help='Audio channels (ReSpeaker 4-Mic = 32)')

    # Model parameters
    parser.add_argument('--model-path', default='yamnet.tflite',
                        help='Path to YAMNet model file')
    parser.add_argument('--class-map', default='yamnet_class_map.csv',
                        help='Path to class map CSV file')

    # Threshold parameters
    parser.add_argument('--rms-threshold', type=float, default=None,
                        help='RMS volume threshold (default: from server or 0.03)')
    parser.add_argument('--danger-threshold', type=float, default=None,
                        help='Danger event confidence threshold (default: from server or 0.75)')

    # Other
    parser.add_argument('--test', action='store_true',
                        help='Test mode: only connect to server, do not start monitoring')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Verbose logging output')

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Initialize server client
    logger.info("Connecting to server...")
    client = ServerClient(args.server_url, args.device_id, args.api_token)

    # Test connection
    logger.info("Sending heartbeat test...")
    heartbeat_result = client.heartbeat({"model_version": "yamnet_v1"})
    if heartbeat_result:
        logger.info(f"Server connected! Server time: {heartbeat_result.get('server_time')}")
    else:
        logger.error("Cannot connect to server. Please check URL and API token.")
        sys.exit(1)

    # Get server config
    config = {}
    server_config = client.get_config()
    if server_config:
        config = {
            'rms_threshold': server_config.get('rms_threshold', RMS_THRESHOLD),
            'danger_threshold': server_config.get('danger_threshold', 0.75),
        }
        logger.info(f"Server config loaded: {config}")

    # CLI args override server config
    if args.rms_threshold is not None:
        config['rms_threshold'] = args.rms_threshold
    if args.danger_threshold is not None:
        config['danger_threshold'] = args.danger_threshold

    if args.test:
        logger.info("Test mode: server connection OK, exiting.")
        return

    # Load YAMNet model
    logger.info("Loading YAMNet model...")
    model = YAMNetModel(args.model_path, args.class_map)

    # Initialize audio capture
    logger.info("Initializing audio device...")
    audio = AudioCapture(
        device_id=args.audio_device,
        channels=args.channels,
        sample_rate=SAMPLE_RATE,
    )

    # Start monitoring service
    service = MonitoringService(model, audio, client, config)

    # Register signal handlers
    def signal_handler(sig, frame):
        logger.info("Stop signal received...")
        service.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    service.start()


if __name__ == '__main__':
    main()
