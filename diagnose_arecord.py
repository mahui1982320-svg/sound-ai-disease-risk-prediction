#!/usr/bin/env python3
"""
diagnose_arecord.py - 诊断 arecord 录音内容
用法: ~/yamnet_venv/bin/python3 ~/diagnose_arecord.py
"""
import subprocess
import wave
import numpy as np
from scipy.signal import resample as scipy_resample
import tflite_runtime.interpreter as tflite

ALSA_DEVICE = "hw:2,0"
SAMPLE_RATE = 16000
DURATION = 2
N_YAMNET = 15600

# Full YAMNet class names around 132
CLASS_NAMES = {
    128: "Boat, Water vehicle",
    129: "Sailboat, sailing ship",
    130: "Rowboat, canoe, kayak",
    131: "Motorboat, speedboat",
    132: "Ferry, steamship",
    133: "Ship",
    134: "Motor vehicle (road)",
    135: "Car",
    136: "Vehicle horn, car horn, honking",
    137: "Toot",
    138: "Car alarm",
    139: "Power windows, electric windows",
    140: "Skidding",
    141: "Tire squeal",
    142: "Car passing by",
    143: "Race car, auto racing",
    144: "Truck",
    145: "Air brake",
    146: "Air horn, truck horn",
    147: "Reversing beeps",
    148: "Ice cream truck, ice cream van",
    149: "Bus",
    150: "Emergency vehicle",
    151: "Police car (siren)",
    152: "Ambulance (siren)",
    153: "Fire engine, fire truck (siren)",
    # common sounds
    0: "Speech",
    1: "Child speech",
    11: "Screaming",
    13: "Laughter",
    33: "Groan",
    39: "Cough",
    494: "Silence",
    495: "White noise",
    496: "Pink noise",
    497: "Throbbing",
    498: "Vibration",
    499: "Television",
    500: "Radio",
}

print("=" * 60)
print("arecord Audio Diagnostics")
print("=" * 60)

# Load YAMNet
print("\n[1] Loading YAMNet...")
interp = tflite.Interpreter(model_path="/home/pi/yamnet.tflite")
interp.allocate_tensors()
in_idx = interp.get_input_details()[0]["index"]
out_idx = interp.get_output_details()[0]["index"]
print("    YAMNet loaded OK")

print(f"\n[2] Recording 3 chunks with arecord -c 2 (stereo). Make noise!\n")

for chunk_num in range(3):
    print(f"--- Chunk {chunk_num+1} ---")
    tmp_wav = "/tmp/diag_chunk.wav"

    # Record stereo
    cmd = ["arecord", "-D", ALSA_DEVICE, "-f", "S16_LE",
           "-r", str(SAMPLE_RATE), "-c", "2", "-d", str(DURATION),
           "-q", tmp_wav]
    result = subprocess.run(cmd, capture_output=True, timeout=DURATION + 5)
    if result.returncode != 0:
        print(f"  ERROR: {result.stderr.decode()}")
        continue

    # Read WAV
    with wave.open(tmp_wav, 'rb') as wf:
        n_frames = wf.getnframes()
        n_ch = wf.getnchannels()
        raw_bytes = wf.readframes(n_frames)
    print(f"  WAV: {n_frames} frames, {n_ch} channels")

    # Parse stereo
    pcm_all = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    ch0 = pcm_all[0::2]  # left channel
    ch1 = pcm_all[1::2]  # right channel

    print(f"  CH0: {len(ch0)} samples, RMS={np.sqrt(np.mean(ch0**2)):.6f}, range=[{ch0.min():.4f}, {ch0.max():.4f}]")
    print(f"  CH1: {len(ch1)} samples, RMS={np.sqrt(np.mean(ch1**2)):.6f}, range=[{ch1.min():.4f}, {ch1.max():.4f}]")
    print(f"  CH0 first 10 values: {ch0[:10]}")
    print(f"  CH0 non-zero count: {np.sum(ch0 != 0)} ({100*np.sum(ch0!=0)/len(ch0):.1f}%)")

    # Check if it's still a ramp
    diffs = np.diff(ch0[:100])
    print(f"  CH0 first-diff stats: mean={diffs.mean():.6f}, std={diffs.std():.6f}")
    if diffs.std() < 0.001:
        print("  WARNING: CH0 looks like a ramp/counter signal!")
    else:
        print("  CH0 looks like real audio (varied differences)")

    # Run YAMNet on CH0
    audio = scipy_resample(ch0, N_YAMNET).astype(np.float32)
    mx = np.max(np.abs(audio))
    if mx > 0:
        audio = audio / mx

    interp.set_tensor(in_idx, audio.reshape(-1))
    interp.invoke()
    scores = np.squeeze(interp.get_tensor(out_idx))
    top5 = np.argsort(scores)[::-1][:5]
    print("  YAMNet top-5 (CH0):")
    for i, idx in enumerate(top5):
        name = CLASS_NAMES.get(int(idx), f"class_{idx}")
        print(f"    {i+1}. [{idx:3d}] {name:40s} {scores[idx]*100:.1f}%")

    # Also try CH1
    audio1 = scipy_resample(ch1, N_YAMNET).astype(np.float32)
    mx1 = np.max(np.abs(audio1))
    if mx1 > 0:
        audio1 = audio1 / mx1
    interp.set_tensor(in_idx, audio1.reshape(-1))
    interp.invoke()
    scores1 = np.squeeze(interp.get_tensor(out_idx))
    top1_ch1 = np.argsort(scores1)[::-1][0]
    print(f"  YAMNet top-1 (CH1): [{top1_ch1}] {CLASS_NAMES.get(int(top1_ch1), f'class_{top1_ch1}')} {scores1[top1_ch1]*100:.1f}%")
    print()

print("=" * 60)
print("Done.")
