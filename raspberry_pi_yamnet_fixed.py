import numpy as np
import tflite_runtime.interpreter as tflite
import sounddevice as sd
import datetime
import sys
import csv

# ============================================================================
# 修复版本 - 支持完整的521个YAMNet音频事件分类
# ============================================================================

# 1. AI 引擎初始化
interpreter = tflite.Interpreter(model_path="yamnet.tflite")
interpreter.allocate_tensors()
in_det = interpreter.get_input_details()
out_det = interpreter.get_output_details()
IN_IDX, OUT_IDX, IN_SHAPE = in_det['index'], out_det['index'], in_det['shape']

# 2. 硬件设置 (ID:8, CH:32)
TARGET_ID = 8
CHANNELS = 32
FS = 16000

print("\n" + "="*70)
print("🚀 [YAMNET FIXED] SYSTEM ONLINE - FULL EVENT DETECTION MODE")
print("🎙️  Monitoring all 521 audio events...")
print("="*70 + "\n")

# ============================================================================
# 修复1：加载完整的521个YAMNet标签
# ============================================================================
def load_yamnet_labels(csv_path="yamnet_class_map.csv"):
    """从CSV文件加载YAMNet的521个标签"""
    labels = {}
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                idx = int(row['index'])
                name = row['display_name']
                labels[idx] = name
        print(f"✓ 已加载 {len(labels)} 个YAMNet标签\n")
        return labels
    except FileNotFoundError:
        print(f"⚠️  警告: 找不到 {csv_path}")
        print("   将使用默认标签。建议下载yamnet_class_map.csv文件\n")
        return get_default_labels()

def get_default_labels():
    """默认标签 - 常见的危险事件"""
    return {
        0: "Speech",
        1: "Child speech, kid speaking",
        2: "Conversation",
        3: "Narration, monologue",
        4: "Expressive singing",
        5: "Singing",
        6: "Soca",
        7: "Toot",
        8: "Trumpet",
        9: "Violin, fiddle",
        10: "Acoustic guitar",
        11: "Electric guitar",
        12: "Bass guitar",
        13: "Acoustic piano",
        14: "Cello",
        15: "Viola",
        16: "Violin, fiddle",
        17: "Pizzicato",
        18: "Plucked string instrument",
        19: "Harpsichord",
        20: "Zither",
        21: "Synthesizer",
        22: "Keyboard musical instrument",
        23: "Drum",
        24: "Snare drum",
        25: "Timpani",
        26: "Cymbal",
        27: "Gong",
        28: "Maraca",
        29: "Rattle",
        30: "Tambourine",
        31: "Shaker",
        32: "Vibraphone",
        33: "Xylophone",
        34: "Marimba, balafon",
        35: "Steelpan",
        36: "Orchestra",
        37: "Accordion",
        38: "Harmonica",
        39: "Applause",
        40: "Audience",
        41: "Crowd",
        42: "Hubbub, speech noise, speech babble",
        43: "Children playing, playing with kids",
        44: "Screaming",
        45: "Shouting",
        46: "Yelling",
        47: "Whispering",
        48: "Laughter",
        49: "Giggling",
        50: "Snoring",
        51: "Coughing",
        52: "Throat clearing",
        53: "Sneezing",
        54: "Breathing",
        55: "Gasp",
        56: "Panting",
        57: "Hiccup",
        58: "Wheezing",
        59: "Groaning",
        60: "Moaning",
        61: "Crying, sobbing",
        62: "Whining, whimpering",
        63: "Wailing, keening",
        64: "Groaning",
        65: "Moaning",
        # ... 更多标签
        494: "Silence",  # 静音
    }

# 加载标签
LABELS = load_yamnet_labels()

# ============================================================================
# 修复2：改进的音频处理 - 保留更多细节
# ============================================================================
def process_audio(recording, target_length=15600):
    """改进的音频处理函数"""
    # 提取Channel 0
    audio = recording[:, 0].flatten()
    
    # 消除直流偏置
    audio = audio - np.mean(audio)
    
    # 计算音量
    rms = np.sqrt(np.mean(audio ** 2))
    
    # 改进的归一化 - 保留更多细节
    if rms > 0.01:  # 只在有实际声音时归一化
        # 使用RMS而不是峰值，保留更多细节
        audio = audio / (rms * 5)  # 乘以5是为了增强信号
        # 限制峰值但保留波形纹理
        audio = np.clip(audio, -0.9, 0.9)
    
    # 截取或填充到目标长度
    if len(audio) >= target_length:
        audio = audio[:target_length]
    else:
        audio = np.pad(audio, (0, target_length - len(audio)), mode='constant')
    
    return audio, rms

# ============================================================================
# 修复3：改进的事件检测逻辑
# ============================================================================
def detect_event(scores, confidence_threshold=0.5):
    """改进的事件检测"""
    top_idx = np.argmax(scores)
    conf = scores[top_idx]
    
    # 修复3：提高置信度阈值从0.1到0.5
    # 这样可以过滤掉大部分误报
    if conf > confidence_threshold and top_idx != 494:
        return top_idx, conf, True
    else:
        return top_idx, conf, False

# ============================================================================
# 主程序
# ============================================================================
try:
    detection_count = 0
    
    while True:
        # A. 录音 0.975秒
        recording = sd.rec(int(0.975 * FS), samplerate=FS, channels=CHANNELS, 
                          device=TARGET_ID, dtype='float32')
        sd.wait()
        
        # B. 处理音频
        audio_ready, rms = process_audio(recording)
        
        # C. AI 推理
        input_data = np.reshape(audio_ready, IN_SHAPE).astype(np.float32)
        interpreter.set_tensor(IN_IDX, input_data)
        interpreter.invoke()
        
        # D. 获取结果
        scores = interpreter.get_tensor(OUT_IDX).flatten()
        top_idx, conf, is_event = detect_event(scores, confidence_threshold=0.5)
        
        time_now = datetime.datetime.now().strftime("%H:%M:%S")
        
        # E. 显示结果
        if is_event:
            # 检测到事件
            event_name = LABELS.get(top_idx, f"Unknown Event ID-{top_idx}")
            detection_count += 1
            
            print(f"\n{'='*70}")
            print(f"[{time_now}] ✓ EVENT #{detection_count} DETECTED")
            print(f"{'='*70}")
            print(f"  Event Type: {event_name}")
            print(f"  Confidence: {conf:.1%}")
            print(f"  Audio Level: {rms:.3f}")
            print(f"  Event ID: {top_idx}")
            print(f"{'='*70}\n")
        else:
            # 监听中
            # 显示音量条
            bar_length = int(rms * 100)
            bar = "█" * min(bar_length, 30)
            
            # 显示当前识别的事件（即使未触发）
            current_event = LABELS.get(top_idx, f"ID-{top_idx}")
            
            print(f"[{time_now}] Listening... Level: {bar:<30} | "
                  f"Top: {current_event} ({conf:.1%})", end='\r')
            sys.stdout.flush()

except KeyboardInterrupt:
    print("\n\n[✓] Program stopped by user")
    print(f"[📊] Total events detected: {detection_count}")
except Exception as e:
    print(f"\n[✗] Error: {e}")
    import traceback
    traceback.print_exc()
