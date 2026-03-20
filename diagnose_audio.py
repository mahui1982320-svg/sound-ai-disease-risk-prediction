#!/usr/bin/env python3
"""
diagnose_audio.py - 诊断 reSpeaker XVF3800 音频采样情况
用法: ~/yamnet_venv/bin/python3 ~/diagnose_audio.py
"""
import numpy as np
import sounddevice as sd
from scipy.signal import resample as scipy_resample
import tflite_runtime.interpreter as tflite

DEVICE = 3
SAMPLE_RATE = 16000
N_RECORD = 32000  # 2 seconds
N_YAMNET = 15600  # YAMNet input size

print("=" * 60)
print("reSpeaker XVF3800 Audio Diagnostics")
print("=" * 60)

# Load YAMNet
print("\n[1] Loading YAMNet...")
interp = tflite.Interpreter(model_path="/home/pi/yamnet.tflite")
interp.allocate_tensors()
in_idx = interp.get_input_details()[0]["index"]
out_idx = interp.get_output_details()[0]["index"]
print("    YAMNet loaded OK")

# Class names (partial)
CLASS_NAMES = {
    0: "Speech", 1: "Child speech", 2: "Conversation", 6: "Shout",
    11: "Screaming", 13: "Laughter", 33: "Groan", 36: "Breathing",
    37: "Wheeze", 38: "Snoring", 39: "Cough", 40: "Sneeze",
    137: "Whale vocalization", 300: "Thud, impact", 494: "Silence",
    495: "White noise", 496: "Pink noise",
}

print("\n[2] Recording 3 chunks (2s each). Please make some noise!\n")
for chunk_num in range(3):
    print(f"--- Chunk {chunk_num+1} ---")
    rec = sd.rec(N_RECORD, samplerate=SAMPLE_RATE, channels=2, device=DEVICE, dtype='float32')
    sd.wait()

    ch0 = rec[:, 0]
    ch1 = rec[:, 1]

    # Stats
    total_samples = len(ch0)
    nonzero_ch0 = ch0[ch0 != 0]
    nonzero_ch1 = ch1[ch1 != 0]

    print(f"  Total samples recorded: {total_samples}")
    print(f"  CH0 non-zero count: {len(nonzero_ch0)} ({100*len(nonzero_ch0)/total_samples:.1f}%)")
    print(f"  CH1 non-zero count: {len(nonzero_ch1)} ({100*len(nonzero_ch1)/total_samples:.1f}%)")

    if len(nonzero_ch0) > 0:
        print(f"  CH0 non-zero RMS:   {np.sqrt(np.mean(nonzero_ch0**2)):.6f}")
        print(f"  CH0 non-zero range: [{nonzero_ch0.min():.6f}, {nonzero_ch0.max():.6f}]")
        print(f"  CH0 all-sample RMS: {np.sqrt(np.mean(ch0**2)):.6f}")
        # Show first 10 non-zero values
        print(f"  First 10 non-zero:  {nonzero_ch0[:10]}")
        # Show spacing between non-zero samples
        nz_indices = np.where(ch0 != 0)[0]
        if len(nz_indices) > 5:
            gaps = np.diff(nz_indices[:20])
            print(f"  Gaps between non-zero (first 20): {gaps}")
    else:
        print("  CH0: ALL ZEROS - no audio!")
        continue

    # Run YAMNet
    nz = nonzero_ch0
    if len(nz) < 10:
        print("  Too few non-zero samples, skipping YAMNet")
        continue

    audio = scipy_resample(nz, N_YAMNET).astype(np.float32)
    mx = np.max(np.abs(audio))
    if mx > 0:
        audio = audio / mx
    print(f"  After resample: shape={audio.shape}, range=[{audio.min():.4f}, {audio.max():.4f}]")

    interp.set_tensor(in_idx, audio.reshape(-1))
    interp.invoke()
    scores = np.squeeze(interp.get_tensor(out_idx))
    top5 = np.argsort(scores)[::-1][:5]
    print("  YAMNet top-5:")
    for i, idx in enumerate(top5):
        name = CLASS_NAMES.get(int(idx), f"class_{idx}")
        print(f"    {i+1}. [{idx:3d}] {name:35s} {scores[idx]*100:.1f}%")
    print()

print("=" * 60)
print("Diagnosis complete.")
print("=" * 60)
