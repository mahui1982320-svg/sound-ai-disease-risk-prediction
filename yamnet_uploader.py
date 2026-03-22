#!/usr/bin/env python3
"""
yamnet_uploader.py  —  YAMNet Raspberry Pi Uploader
=====================================================
Runs YAMNet inference on continuous microphone audio and uploads
dangerous-event results to the elderly-safety-monitor web platform
via its tRPC HTTP API.

Requirements
------------
    pip install numpy requests tflite-runtime scipy
    sudo apt install alsa-utils   (for arecord)

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
    from scipy.signal import resample as scipy_resample
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

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

# Class IDs that are impossible in a home environment.
# If these appear as top-1, it almost certainly indicates an audio processing
# artifact (DC offset, normalization of noise, etc.).
# When a blacklisted class is top-1, we skip it and promote the next result.
HOME_BLACKLIST_CLASS_IDS: set[int] = {
    132,  # Whale vocalization — the most common false positive from noise amplification
    133,  # Music (generic) — often appears alongside Whale vocalization artifacts
}

CLASS_TO_EVENT_TYPE: dict[int, str] = {
    6: "scream", 7: "scream", 9: "scream", 11: "scream",
    19: "scream", 20: "scream", 22: "scream",
    33: "cough", 39: "cough", 42: "cough",
    300: "fall", 301: "fall", 310: "fall", 315: "fall", 316: "fall",
    317: "moan", 390: "moan", 393: "moan", 394: "moan", 399: "moan",
    420: "scream",
}

# YAMNet 521 class names (full list from AudioSet)
YAMNET_CLASS_NAMES: dict[int, str] = {
    0: "Speech",
    1: "Child speech, kid speaking",
    2: "Conversation",
    3: "Narration, monologue",
    4: "Babbling",
    5: "Speech synthesizer",
    6: "Shout",
    7: "Bellow",
    8: "Whoop",
    9: "Yell",
    10: "Children shouting",
    11: "Screaming",
    12: "Whispering",
    13: "Laughter",
    14: "Baby laughter",
    15: "Giggle",
    16: "Snicker",
    17: "Belly laugh",
    18: "Chuckle, chortle",
    19: "Crying, sobbing",
    20: "Baby cry, infant cry",
    21: "Whimper",
    22: "Wail, moan",
    23: "Sigh",
    24: "Singing",
    25: "Choir",
    26: "Yodeling",
    27: "Chant",
    28: "Mantra",
    29: "Child singing",
    30: "Synthetic singing",
    31: "Rapping",
    32: "Humming",
    33: "Groan",
    34: "Grunt",
    35: "Whistling",
    36: "Breathing",
    37: "Wheeze",
    38: "Snore",
    39: "Snort",
    40: "Gasp",
    41: "Pant",
    42: "Hiccup",
    43: "Cough",
    44: "Throat clearing",
    45: "Sneeze",
    46: "Sniff",
    47: "Run",
    48: "Shuffle",
    49: "Walk, footsteps",
    50: "Chewing, mastication",
    51: "Biting",
    52: "Gargling",
    53: "Stomach rumble",
    54: "Burping, eructation",
    55: "Hiccup",
    56: "Fart",
    57: "Hands",
    58: "Finger snapping",
    59: "Clapping",
    60: "Heart sounds, heartbeat",
    61: "Heart murmur",
    62: "Cheering",
    63: "Applause",
    64: "Chatter",
    65: "Crowd",
    66: "Hubbub, speech noise, speech babble",
    67: "Children playing",
    68: "Animal",
    69: "Domestic animals, pets",
    70: "Dog",
    71: "Bark",
    72: "Yip",
    73: "Howl",
    74: "Bow-wow",
    75: "Growling",
    76: "Whimper (dog)",
    77: "Cat",
    78: "Purr",
    79: "Meow",
    80: "Hiss",
    81: "Caterwaul",
    82: "Livestock, farm animals, working animals",
    83: "Horse",
    84: "Clip-clop",
    85: "Neigh, whinny",
    86: "Cattle, bovinae",
    87: "Moo",
    88: "Cowbell",
    89: "Pig",
    90: "Oink",
    91: "Goat",
    92: "Bleat",
    93: "Sheep",
    94: "Fowl",
    95: "Chicken, rooster",
    96: "Cluck",
    97: "Crowing, cock-a-doodle-doo",
    98: "Turkey",
    99: "Gobble",
    100: "Duck",
    101: "Quack",
    102: "Goose",
    103: "Honk",
    104: "Wild animals",
    105: "Roaring cats (lions, tigers)",
    106: "Roar",
    107: "Bird",
    108: "Bird vocalization, bird call, bird song",
    109: "Chirp, tweet",
    110: "Squawk",
    111: "Pigeon, dove",
    112: "Coo",
    113: "Crow",
    114: "Caw",
    115: "Owl",
    116: "Hoot",
    117: "Bird flight, flapping wings",
    118: "Canidae, dogs, wolves",
    119: "Rodents, rats, mice",
    120: "Mouse",
    121: "Patter",
    122: "Insect",
    123: "Cricket",
    124: "Mosquito",
    125: "Fly, housefly",
    126: "Buzz",
    127: "Bee, wasp, etc.",
    128: "Frog",
    129: "Croak",
    130: "Snake",
    131: "Rattle",
    132: "Whale vocalization",
    133: "Music",
    134: "Musical instrument",
    135: "Plucked string instrument",
    136: "Guitar",
    137: "Electric guitar",
    138: "Bass guitar",
    139: "Acoustic guitar",
    140: "Steel guitar, slide guitar",
    141: "Tapping (guitar technique)",
    142: "Strum",
    143: "Banjo",
    144: "Sitar",
    145: "Mandolin",
    146: "Zither",
    147: "Ukulele",
    148: "Keyboard (musical)",
    149: "Piano",
    150: "Electric piano",
    151: "Organ",
    152: "Electronic organ",
    153: "Hammond organ",
    154: "Synthesizer",
    155: "Sampler",
    156: "Harpsichord",
    157: "Percussion",
    158: "Drum kit",
    159: "Drum machine",
    160: "Drum",
    161: "Snare drum",
    162: "Rimshot",
    163: "Drum roll",
    164: "Bass drum",
    165: "Timpani",
    166: "Tabla",
    167: "Cymbal",
    168: "Hi-hat",
    169: "Wood block",
    170: "Tambourine",
    171: "Rattle (instrument)",
    172: "Maraca",
    173: "Gong",
    174: "Tubular bells",
    175: "Mallet percussion",
    176: "Marimba, xylophone",
    177: "Glockenspiel",
    178: "Vibraphone",
    179: "Steelpan",
    180: "Orchestra",
    181: "Brass instrument",
    182: "French horn",
    183: "Trumpet",
    184: "Trombone",
    185: "Bowed string instrument",
    186: "String section",
    187: "Violin, fiddle",
    188: "Pizzicato",
    189: "Cello",
    190: "Double bass",
    191: "Wind instrument, woodwind instrument",
    192: "Flute",
    193: "Saxophone",
    194: "Clarinet",
    195: "Harp",
    196: "Bell",
    197: "Church bell",
    198: "Jingle bell",
    199: "Bicycle bell",
    200: "Tuning fork",
    201: "Chime",
    202: "Wind chime",
    203: "Change ringing (campanology)",
    204: "Harmonica",
    205: "Accordion",
    206: "Bagpipes",
    207: "Didgeridoo",
    208: "Shofar",
    209: "Theremin",
    210: "Singing bowl",
    211: "Scratching (performance technique)",
    212: "Pop music",
    213: "Hip hop music",
    214: "Beatboxing",
    215: "Rock music",
    216: "Heavy metal",
    217: "Punk rock",
    218: "Grunge",
    219: "Progressive rock",
    220: "Rock and roll",
    221: "Psychedelic rock",
    222: "Rhythm and blues",
    223: "Soul music",
    224: "Reggae",
    225: "Country",
    226: "Swing music",
    227: "Bluegrass",
    228: "Funk",
    229: "Folk music",
    230: "Middle Eastern music",
    231: "Jazz",
    232: "Disco",
    233: "Classical music",
    234: "Opera",
    235: "Electronic music",
    236: "House music",
    237: "Techno",
    238: "Dubstep",
    239: "Drum and bass",
    240: "Electronica",
    241: "Electronic dance music",
    242: "Ambient music",
    243: "Trance music",
    244: "Music of Latin America",
    245: "Salsa music",
    246: "Flamenco",
    247: "Blues",
    248: "Music for children",
    249: "New-age music",
    250: "Vocal music",
    251: "A capella",
    252: "Music of Africa",
    253: "Afrobeat",
    254: "Christian music",
    255: "Gospel music",
    256: "Music of Asia",
    257: "Carnatic music",
    258: "Music of Bollywood",
    259: "Ska",
    260: "Traditional music",
    261: "Independent music",
    262: "Song",
    263: "Background music",
    264: "Theme music",
    265: "Jingle (music)",
    266: "Soundtrack music",
    267: "Lullaby",
    268: "Video game music",
    269: "Christmas music",
    270: "Dance music",
    271: "Wedding music",
    272: "Happy music",
    273: "Funny music",
    274: "Sad music",
    275: "Tender music",
    276: "Exciting music",
    277: "Angry music",
    278: "Scary music",
    279: "Wind",
    280: "Rustling leaves",
    281: "Wind noise (microphone)",
    282: "Thunderstorm",
    283: "Thunder",
    284: "Water",
    285: "Rain",
    286: "Raindrop",
    287: "Rain on surface",
    288: "Stream",
    289: "Waterfall",
    290: "Ocean",
    291: "Waves, surf",
    292: "Steam",
    293: "Gurgling",
    294: "Fire",
    295: "Crackle",
    296: "Vehicle",
    297: "Boat, Water vehicle",
    298: "Sailboat, sailing ship",
    299: "Rowboat, canoe, kayak",
    300: "Motorboat, speedboat",
    301: "Ship",
    302: "Motor vehicle (road)",
    303: "Car",
    304: "Vehicle horn, car horn, honking",
    305: "Toot",
    306: "Car alarm",
    307: "Power windows, electric windows",
    308: "Skidding",
    309: "Tire squeal",
    310: "Car passing by",
    311: "Race car, auto racing",
    312: "Truck",
    313: "Air brake",
    314: "Air horn, truck horn",
    315: "Reversing beeps",
    316: "Ice cream truck, ice cream van",
    317: "Police car (siren)",
    318: "Ambulance (siren)",
    319: "Fire engine, fire truck (siren)",
    320: "Motorcycle",
    321: "Traffic noise, roadway noise",
    322: "Rail transport",
    323: "Train",
    324: "Train whistle",
    325: "Train horn",
    326: "Railroad car, train wagon",
    327: "Train wheels squealing",
    328: "Subway, metro, underground",
    329: "Aircraft",
    330: "Aircraft engine",
    331: "Jet engine",
    332: "Propeller, airscrew",
    333: "Helicopter",
    334: "Fixed-wing aircraft, airplane",
    335: "Bicycle",
    336: "Skateboard",
    337: "Engine",
    338: "Light engine (high frequency)",
    339: "Dental drill, dentist's drill",
    340: "Lawn mower",
    341: "Chainsaw",
    342: "Medium engine (mid frequency)",
    343: "Heavy engine (low frequency)",
    344: "Engine knocking",
    345: "Engine starting",
    346: "Idling",
    347: "Accelerating, revving, vroom",
    348: "Door",
    349: "Doorbell",
    350: "Ding-dong",
    351: "Sliding door",
    352: "Slam",
    353: "Knock",
    354: "Tap",
    355: "Squeak",
    356: "Cupboard open or close",
    357: "Drawer open or close",
    358: "Dishes, pots, and pans",
    359: "Cutlery, silverware",
    360: "Chopping (food)",
    361: "Frying (food)",
    362: "Microwave oven",
    363: "Blender",
    364: "Water tap, faucet",
    365: "Sink (filling or washing)",
    366: "Bathtub (filling or washing)",
    367: "Hair dryer",
    368: "Toilet flush",
    369: "Toothbrush",
    370: "Electric toothbrush",
    371: "Vacuum cleaner",
    372: "Zipper (clothing)",
    373: "Keys jangling",
    374: "Coin (dropping)",
    375: "Scissors",
    376: "Electric shaver, electric razor",
    377: "Shuffling cards",
    378: "Typing",
    379: "Typewriter",
    380: "Computer keyboard",
    381: "Writing",
    382: "Alarm",
    383: "Telephone",
    384: "Telephone bell ringing",
    385: "Ringtone",
    386: "Telephone dialing, DTMF",
    387: "Dial tone",
    388: "Busy signal",
    389: "Alarm clock",
    390: "Siren",
    391: "Civil defense siren",
    392: "Buzzer",
    393: "Smoke detector, smoke alarm",
    394: "Fire alarm",
    395: "Foghorn",
    396: "Whistle",
    397: "Steam whistle",
    398: "Mechanisms",
    399: "Ratchet, pawl",
    400: "Clock",
    401: "Tick",
    402: "Tick-tock",
    403: "Gears",
    404: "Pulleys",
    405: "Sewing machine",
    406: "Mechanical fan",
    407: "Air conditioning",
    408: "Cash register",
    409: "Printer",
    410: "Camera",
    411: "Single-lens reflex camera",
    412: "Tools",
    413: "Hammer",
    414: "Jackhammer",
    415: "Sawing",
    416: "Filing (rasp)",
    417: "Sanding",
    418: "Power tool",
    419: "Drill",
    420: "Explosion",
    421: "Gunshot, gunfire",
    422: "Machine gun",
    423: "Fusillade",
    424: "Artillery fire",
    425: "Cap gun",
    426: "Fireworks",
    427: "Firecracker",
    428: "Burst, pop",
    429: "Eruption",
    430: "Boom",
    431: "Wood",
    432: "Chop",
    433: "Splinter",
    434: "Crack",
    435: "Glass",
    436: "Chink, clink",
    437: "Shatter",
    438: "Liquid",
    439: "Splash, splatter",
    440: "Slosh",
    441: "Squish",
    442: "Drip",
    443: "Pour",
    444: "Trickle, dribble",
    445: "Gush",
    446: "Fill (with liquid)",
    447: "Spray",
    448: "Pump (liquid)",
    449: "Stir",
    450: "Boiling",
    451: "Sonar",
    452: "Arrow",
    453: "Whoosh, swoosh, swish",
    454: "Thump, thud",
    455: "Thunk",
    456: "Electronic tuner",
    457: "Effects unit",
    458: "Chorus effect",
    459: "Basketball bounce",
    460: "Bang",
    461: "Slap, smack",
    462: "Whack, thwack",
    463: "Smash, crash",
    464: "Breaking",
    465: "Bouncing",
    466: "Whip",
    467: "Flap",
    468: "Scratch",
    469: "Scrape",
    470: "Rub",
    471: "Roll",
    472: "Crushing",
    473: "Crumpling, crinkling",
    474: "Tearing",
    475: "Beep, bleep",
    476: "Ping",
    477: "Ding",
    478: "Clang",
    479: "Squeal",
    480: "Creak",
    481: "Rustle",
    482: "Whir",
    483: "Clatter",
    484: "Sizzle",
    485: "Clicking",
    486: "Clickety-clack",
    487: "Rumble",
    488: "Plop",
    489: "Jingle, tinkle",
    490: "Hum",
    491: "Zing",
    492: "Boing",
    493: "Crunch",
    494: "Silence",
    495: "Sine wave",
    496: "Harmonic",
    497: "Chirp tone",
    498: "Sound effect",
    499: "Pulse",
    500: "Inside, small room",
    501: "Inside, large room or hall",
    502: "Inside, public space",
    503: "Outside, urban or manmade",
    504: "Outside, rural or natural",
    505: "Reverberation",
    506: "Echo",
    507: "Noise",
    508: "Environmental noise",
    509: "Static",
    510: "Mains hum",
    511: "Distortion",
    512: "Sidetone",
    513: "Cacophony",
    514: "White noise",
    515: "Pink noise",
    516: "Throbbing",
    517: "Vibration",
    518: "Television",
    519: "Radio",
    520: "Field recording",
}

# =============================================================================
# Configuration defaults
# =============================================================================

SAMPLE_RATE        = 16_000   # Hz  (YAMNet requirement)
CHUNK_DURATION     = 0.975    # seconds per inference window
CHUNK_SAMPLES      = int(SAMPLE_RATE * CHUNK_DURATION)
# Runtime sample rate (may be overridden by --sample-rate arg)
_runtime_sample_rate: int = SAMPLE_RATE
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
    """Send a heartbeat with system status and return the server config."""
    status: dict = {"model_version": MODEL_VERSION}
    if cpu_temp is not None:
        status["cpu_temp"] = cpu_temp

    # CPU 使用率 (1分钟平均负载 / CPU核数 * 100)
    try:
        with open("/proc/loadavg", "r") as f:
            load_1min = float(f.read().split()[0])
        import os
        cpu_count = os.cpu_count() or 4
        status["cpu_usage"] = round(min(load_1min / cpu_count * 100, 100), 1)
    except Exception:
        pass

    # 内存使用率
    try:
        with open("/proc/meminfo", "r") as f:
            lines = f.readlines()
        mem_total = mem_available = 0
        for line in lines:
            if line.startswith("MemTotal:"):
                mem_total = int(line.split()[1])
            elif line.startswith("MemAvailable:"):
                mem_available = int(line.split()[1])
        if mem_total > 0:
            status["memory_usage"] = round((1 - mem_available / mem_total) * 100, 1)
    except Exception:
        pass

    # 系统运行时长 (秒)
    try:
        with open("/proc/uptime", "r") as f:
            status["uptime"] = int(float(f.read().split()[0]))
    except Exception:
        pass

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
# Audio recording  —  direct sd.rec() (proven to work with reSpeaker XVF3800)
#
# Based on yamnet_final.py which was verified working on 2026-03-19.
# Key points:
#   - device_index=0 (integer, not string)
#   - channels=2
#   - Only use channel 0: rec[:,0].flatten()
#   - Normalize by max amplitude
#   - RMS trigger: skip inference if audio is too quiet
# =============================================================================

# =============================================================================
# reSpeaker XVF3800 — ALSA arecord method (2026-03-20)
# =============================================================================
# DIAGNOSIS RESULT: sounddevice/PortAudio returns a sawtooth ramp signal
# (values 0.039→0.074 monotonically increasing, gap=24 between non-zero samples).
# This is NOT real audio — it's a USB frame counter leaking into the audio buffer.
# YAMNet always classifies this ramp as "Whale vocalization" (class 132, 96.9%).
#
# FIX: Use ALSA arecord directly, which bypasses PortAudio and gets real PCM data.
# Command: arecord -D hw:2,0 -f S16_LE -r 16000 -c 1 -d 2 /tmp/chunk.wav
# =============================================================================

import subprocess
import struct

RMS_TRIGGER = 0.02    # skip inference if AC RMS (nz.std()) below this
                       # reSpeaker XVF3800 fixed noise floor: ac_rms ≈ 0.0135~0.0140
                       # Real speech/sounds produce ac_rms > 0.05
                       # Threshold 0.02 filters out the fixed noise pattern
ALSA_DEVICE = "hw:2,0"  # reSpeaker XVF3800 ALSA device


def usb_reset_respeaker() -> bool:
    """
    Soft-reset the reSpeaker XVF3800 USB device using /sys/bus/usb/devices.
    This simulates a physical unplug+replug, which is required after reboot
    to activate the XVF3800 DSP firmware and get real microphone audio.

    Root cause (verified 2026-03-22):
    After reboot, reSpeaker outputs a fixed noise floor (RMS≈0.0135) that does
    not respond to real audio. A USB reset forces firmware re-initialization.

    Requires: script must be run as root, or pi user must have write access to
    /sys/bus/usb/devices/*/authorized (add udev rule if needed).
    Returns True if reset succeeded, False otherwise.
    """
    RESPEAKER_VENDOR = "2886"
    RESPEAKER_PRODUCT = "001a"
    try:
        # Find the USB device path via sysfs
        usb_devices_path = Path("/sys/bus/usb/devices")
        for dev_path in usb_devices_path.iterdir():
            id_vendor_file = dev_path / "idVendor"
            id_product_file = dev_path / "idProduct"
            authorized_file = dev_path / "authorized"
            if not (id_vendor_file.exists() and id_product_file.exists()):
                continue
            vendor = id_vendor_file.read_text().strip()
            product = id_product_file.read_text().strip()
            if vendor == RESPEAKER_VENDOR and product == RESPEAKER_PRODUCT:
                log.info("[USB RESET] Found reSpeaker at %s (vendor=%s product=%s)",
                         dev_path.name, vendor, product)
                if authorized_file.exists():
                    # Deauthorize (disconnect)
                    authorized_file.write_text("0")
                    time.sleep(1)
                    # Reauthorize (reconnect)
                    authorized_file.write_text("1")
                    time.sleep(3)  # Wait for firmware to reinitialize
                    log.info("[USB RESET] reSpeaker USB reset complete, waiting 3s for firmware init")
                    return True
                else:
                    log.warning("[USB RESET] authorized file not found at %s", authorized_file)
        log.warning("[USB RESET] reSpeaker device not found in /sys/bus/usb/devices")
    except PermissionError:
        log.warning("[USB RESET] Permission denied — add 'pi ALL=(ALL) NOPASSWD: /bin/bash' or run as root")
    except Exception as exc:
        log.warning("[USB RESET] USB reset failed: %s", exc)
    return False


def find_alsa_device() -> str:
    """
    Find the ALSA device string for reSpeaker XVF3800.
    Searches /proc/asound/cards for 'xvf' or 'respeaker'.
    USB device card numbers can change between reboots, so we always
    detect dynamically instead of using a hardcoded number.
    Falls back to hw:2,0 only if detection fails entirely.
    """
    try:
        cards_text = Path("/proc/asound/cards").read_text()
        log.info("ALSA cards detected:\n%s", cards_text.strip())
        for line in cards_text.splitlines():
            line_lower = line.lower()
            if any(k in line_lower for k in ('xvf', 'respeaker', 'array')):
                # Extract card number from line like " 2 [XVF3800       ]: ..."
                parts = line.strip().split()
                if parts and parts[0].isdigit():
                    card_num = int(parts[0])
                    device = f"hw:{card_num},0"
                    log.info("reSpeaker detected: ALSA device=%s (card %d)", device, card_num)
                    return device
        log.warning("reSpeaker not found in /proc/asound/cards, trying arecord -l...")
        # Fallback: parse arecord -l output
        result = subprocess.run(["arecord", "-l"], capture_output=True, text=True, timeout=5)
        for line in result.stdout.splitlines():
            line_lower = line.lower()
            if any(k in line_lower for k in ('xvf', 'respeaker', 'array')):
                # Line like: "card 1: Array [reSpeaker XVF3800 4-Mic Array], device 0: USB Audio [USB Audio]"
                import re
                m = re.search(r'card\s+(\d+)', line)
                if m:
                    card_num = int(m.group(1))
                    device = f"hw:{card_num},0"
                    log.info("reSpeaker detected via arecord -l: ALSA device=%s", device)
                    return device
    except Exception as exc:
        log.warning("ALSA device detection failed: %s", exc)
    log.warning("Using fallback ALSA device: %s — this may be wrong after reboot!", ALSA_DEVICE)
    return ALSA_DEVICE


def record_audio_arecord(alsa_device: str, sample_rate: int,
                         duration: float = 2.0) -> tuple[np.ndarray, float]:
    """
    Record audio using ALSA arecord command and process for YAMNet.

    This bypasses sounddevice/PortAudio which was found to return a sawtooth
    ramp signal (USB frame counter) instead of real microphone audio.

    Processing pipeline (validated 2026-03-20):
      1. arecord captures 2s WAV at 16kHz stereo
      2. Extract channel 0 as int16
      3. Convert to float32 / 32768
      4. Extract non-zero samples (reSpeaker sparse format)
      5. Resample to 15600 samples (YAMNet input size)
      6. Subtract mean (remove DC offset) — eliminates "Whale vocalization" false positives
      7. Normalize to ±1.0

    Returns (audio_float32_mono_15600, ac_rms).
    """
    import tempfile
    n_samples = int(sample_rate * CHUNK_DURATION)   # 15600 at 16 kHz
    tmp_wav = "/tmp/yamnet_chunk.wav"

    # Record via arecord: S16_LE, 16kHz, 2 channels
    # NOTE: reSpeaker XVF3800 does NOT support mono (-c 1), must use stereo (-c 2)
    # We extract channel 0 after reading the interleaved stereo data.
    n_channels_rec = 2
    cmd = [
        "arecord",
        "-D", alsa_device,
        "-f", "S16_LE",
        "-r", str(sample_rate),
        "-c", str(n_channels_rec),
        "-d", str(int(duration)),
        "-q",          # quiet (suppress progress output)
        tmp_wav,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=duration + 5)
        if result.returncode != 0:
            err = result.stderr.decode(errors='replace').strip()
            log.error("arecord failed (rc=%d): %s", result.returncode, err)
            return np.zeros(n_samples, dtype=np.float32), 0.0
    except subprocess.TimeoutExpired:
        log.error("arecord timed out")
        return np.zeros(n_samples, dtype=np.float32), 0.0
    except FileNotFoundError:
        log.error("arecord not found — install with: sudo apt install alsa-utils")
        return np.zeros(n_samples, dtype=np.float32), 0.0

    # Read WAV file
    try:
        with wave.open(tmp_wav, 'rb') as wf:
            n_frames = wf.getnframes()
            n_ch = wf.getnchannels()
            raw_bytes = wf.readframes(n_frames)
        # Convert S16_LE interleaved stereo to float32, extract channel 0
        pcm_all = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32)
        pcm_all = pcm_all / 32768.0   # normalize to [-1, 1]
        if n_ch == 2:
            # Interleaved: [L0, R0, L1, R1, ...] -> take every other sample
            pcm = pcm_all[0::2]   # channel 0 (left)
            log.debug("Stereo WAV: extracted channel 0, %d samples", len(pcm))
        else:
            pcm = pcm_all
    except Exception as exc:
        log.error("Failed to read WAV: %s", exc)
        return np.zeros(n_samples, dtype=np.float32), 0.0

    if len(pcm) == 0:
        return np.zeros(n_samples, dtype=np.float32), 0.0

    # reSpeaker XVF3800 outputs sparse PCM: only 1 non-zero sample per 24 frames.
    # Extract non-zero samples — these are the real audio values at ~667 Hz.
    nz = pcm[pcm != 0]
    log.debug("arecord: total=%d non-zero=%d (%.1f%%)", len(pcm), len(nz),
              100 * len(nz) / len(pcm) if len(pcm) > 0 else 0)

    if len(nz) < 10:
        # Truly silent or device error
        return np.zeros(n_samples, dtype=np.float32), 0.0

    # Use AC RMS (std dev of non-zero samples) as the true signal level.
    # This ignores DC offset and gives a more accurate measure of actual audio energy.
    ac_rms = float(nz.std())

    # Resample non-zero samples from ~667 Hz to 16000 Hz (15600 samples)
    if HAS_SCIPY:
        audio = scipy_resample(nz, n_samples).astype(np.float32)
    else:
        x_old = np.linspace(0, 1, len(nz))
        x_new = np.linspace(0, 1, n_samples)
        audio = np.interp(x_new, x_old, nz).astype(np.float32)

    # *** CRITICAL: Remove DC offset ***
    # reSpeaker XVF3800 sparse sampling introduces a DC bias in the signal.
    # Without this step, YAMNet misclassifies the DC component as "Whale vocalization".
    # Subtracting the mean centers the waveform around zero, eliminating the DC bias.
    audio = audio - np.mean(audio)

    # Conditional normalization for YAMNet input
    # IMPORTANT: Only normalize when the signal is strong enough (max_amp > 0.1).
    # When the signal is very weak (silence/background noise), normalizing would
    # amplify the noise ~80x to ±1.0, causing YAMNet to misclassify it as
    # "Whale vocalization". Keeping weak signals at their original amplitude
    # lets YAMNet correctly identify them as Silence.
    max_amp = np.max(np.abs(audio))
    if max_amp > 0.1:
        audio = audio / max_amp

    return audio, ac_rms


class AudioStream:
    """
    Audio recording wrapper for reSpeaker XVF3800.
    Uses ALSA arecord to bypass PortAudio's broken USB audio handling.
    """

    def __init__(self, device_index, sample_rate: int):
        # Step 1: USB soft-reset to activate XVF3800 firmware after reboot
        # Without this, reSpeaker outputs fixed noise floor (RMS≈0.0135) that
        # does not respond to real audio. Verified 2026-03-22.
        log.info("[USB RESET] Attempting USB soft-reset of reSpeaker XVF3800...")
        reset_ok = usb_reset_respeaker()
        if reset_ok:
            log.info("[USB RESET] USB reset succeeded, waiting 3s for ALSA to re-enumerate...")
            time.sleep(3)
        else:
            log.warning("[USB RESET] USB reset failed or skipped, proceeding anyway")
        # Step 2: Detect ALSA device (card number may change after reboot)
        self.alsa_device = find_alsa_device()
        self.sample_rate = sample_rate
        log.info("AudioStream ready: ALSA device=%s  sample_rate=%d Hz",
                 self.alsa_device, sample_rate)
        # Step 3: Wait for mic to produce real audio (not just fixed noise floor)
        self._wait_for_mic_ready()

    def _wait_for_mic_ready(self, max_attempts: int = 30, stable_threshold: float = 0.001):
        """
        reSpeaker XVF3800 outputs a fixed noise floor (RMS≈0.0135) during cold start.
        Wait until RMS values show variation (std > stable_threshold), which means
        the microphone DSP has finished initializing and is capturing real audio.
        """
        log.info("[MIC READY] Waiting for reSpeaker to finish cold-start initialization...")
        rms_history = []
        for attempt in range(1, max_attempts + 1):
            try:
                _, ac_rms = record_audio_arecord(self.alsa_device, self.sample_rate)
                rms_history.append(ac_rms)
                if len(rms_history) >= 5:
                    rms_std = float(np.std(rms_history[-5:]))
                    if rms_std > stable_threshold:
                        log.info("[MIC READY] Microphone ready after %d attempts (rms_std=%.5f)",
                                 attempt, rms_std)
                        return
                log.info("[MIC READY] Attempt %d/%d: ac_rms=%.5f (waiting for variation)",
                         attempt, max_attempts, ac_rms)
            except Exception as e:
                log.warning("[MIC READY] Attempt %d failed: %s", attempt, e)
        log.warning("[MIC READY] Microphone may not be fully ready after %d attempts, starting anyway",
                    max_attempts)

    def read_chunk(self) -> tuple[np.ndarray, float]:
        """Record one chunk using arecord. Returns (audio, rms)."""
        return record_audio_arecord(self.alsa_device, self.sample_rate)

    def close(self):
        pass   # nothing to close for sd.rec() style


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

    # Get the expected input shape from the model (e.g. [15600])
    inp_details = interpreter.get_input_details()
    expected_shape = (inp_details[0] if isinstance(inp_details, list) else inp_details)["shape"]
    expected_len = int(np.prod(expected_shape))

    # Pad or truncate audio to match model's fixed input size
    inp_tensor = audio.astype(np.float32)
    if len(inp_tensor) < expected_len:
        inp_tensor = np.pad(inp_tensor, (0, expected_len - len(inp_tensor)))
    else:
        inp_tensor = inp_tensor[:expected_len]

    # Reshape to match model input (e.g. [15600] or [1, 15600])
    inp_tensor = inp_tensor.reshape(expected_shape)

    interpreter.set_tensor(in_idx, inp_tensor)
    interpreter.invoke()
    scores = interpreter.get_tensor(out_idx)   # shape: (1, 521) or (521,)
    scores = np.squeeze(scores)
    elapsed_ms = (time.perf_counter() - t0) * 1000

    top_indices = np.argsort(scores)[::-1][:20]  # get top-20 to have room after filtering
    results = []
    for idx in top_indices:
        cid   = int(idx)
        cname = YAMNET_CLASS_NAMES.get(cid, f"class_{cid}")
        conf  = float(scores[cid])
        results.append((cid, cname, conf))

    # ── Home environment blacklist filter ──
    # Remove classes that are physically impossible in a home (e.g. Whale vocalization).
    # These are almost always artifacts from audio processing issues.
    blacklisted = [(cid, cname, conf) for cid, cname, conf in results
                   if cid in HOME_BLACKLIST_CLASS_IDS]
    if blacklisted:
        original_top = results[0] if results else None
        results = [(cid, cname, conf) for cid, cname, conf in results
                   if cid not in HOME_BLACKLIST_CLASS_IDS]
        if original_top and original_top[0] in HOME_BLACKLIST_CLASS_IDS:
            log.warning("Blacklist filter: removed '%s' (conf=%.1f%%) — likely audio artifact",
                        original_top[1], original_top[2] * 100)

    # Keep only top-10 after filtering
    results = results[:10]

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
    parser.add_argument("--sample-rate", type=int, default=16000,
                        help="Microphone hardware sample rate in Hz (default: 16000). "
                             "Use 48000 for reSpeaker if getting wrong classifications.")
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
    log.info("  sample_rate: %d Hz", args.sample_rate)
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

        # Note: sounddevice is no longer required — we use ALSA arecord directly
        # which bypasses PortAudio's broken USB audio handling for reSpeaker XVF3800.

    # ── open audio stream (unless demo) ──────────────────────────────────────
    audio_stream = None
    if not args.demo:
        try:
            audio_stream = AudioStream(args.mic_device, args.sample_rate)
        except Exception as exc:
            log.error("Failed to open audio stream: %s", exc)
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
            raw_rms = 0.0
            if args.demo:
                top_results, elapsed_ms = demo_inference()
                time.sleep(0.5)   # simulate recording time
            else:
                try:
                    audio, raw_rms = audio_stream.read_chunk()
                except Exception as exc:
                    log.error("Recording error: %s", exc)
                    time.sleep(1)
                    continue

                # Skip inference if AC RMS (signal energy without DC) is too low.
                # This uses nz.std() internally, which ignores DC offset for
                # more accurate silence detection.
                if raw_rms < RMS_TRIGGER:
                    log.info("[%04d] Skipped (silence: ac_rms=%.5f < %.3f)",
                             iteration, raw_rms, RMS_TRIGGER)
                    continue

                top_results, elapsed_ms = run_inference(
                    interpreter, in_idx, out_idx, audio
                )

            # log top result
            if top_results:
                cid, cname, conf = top_results[0]
                danger_flag = "*** DANGER ***" if cid in DANGER_CLASS_IDS else ""
                rms_str = f" ac_rms={raw_rms:.4f}" if audio is not None else ""
                log.info("[%04d] %-30s conf=%.1f%%%s  %s",
                         iteration, cname, conf * 100, rms_str, danger_flag)

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
    finally:
        if audio_stream:
            audio_stream.close()


if __name__ == "__main__":
    main()
