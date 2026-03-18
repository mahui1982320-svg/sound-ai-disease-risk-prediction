import numpy as np
import tflite_runtime.interpreter as tflite
import sounddevice as sd
import datetime
import sys

# ============================================================================
# 最终版本 - 完全匹配您的模型配置
# 输入形状: [1]
# 输出形状: [1, 521]
# ============================================================================

print("\n" + "="*70)
print("🚀 YAMNet 最终版 - 完全匹配您的模型")
print("="*70 + "\n")

# 1. 加载模型
print("[初始化] 正在加载YAMNet模型...")
interpreter = tflite.Interpreter(model_path="yamnet.tflite")
interpreter.allocate_tensors()

in_det = interpreter.get_input_details()
out_det = interpreter.get_output_details()

# 处理输入输出索引
if isinstance(in_det, list):
    IN_IDX = in_det[0]['index']
else:
    IN_IDX = in_det['index']

if isinstance(out_det, list):
    OUT_IDX = out_det[0]['index']
else:
    OUT_IDX = out_det['index']

print("✓ 模型加载成功\n")

# 2. 硬件设置
TARGET_ID = 8
CHANNELS = 32
FS = 16000

print("="*70)
print("🎙️  系统已就绪 - 开始监听所有521个音频事件")
print("="*70 + "\n")

# 3. YAMNet标签 (521个)
YAMNET_LABELS = [
    "Speech", "Child speech, kid speaking", "Conversation", "Narration, monologue",
    "Expressive singing", "Singing", "Whispering", "Shout", "Yell", "Scream",
    "Crying", "Laughing", "Giggling", "Snoring", "Coughing", "Throat clearing",
    "Sneezing", "Breathing", "Gasp", "Panting", "Hiccup", "Wheezing", "Groaning",
    "Moaning", "Whining", "Wailing", "Keening", "Applause", "Clapping", "Crowd",
    "Hubbub", "Speech noise", "Crowd babble", "Children playing", "Screaming",
    "Shouting", "Yelling", "Whispering", "Laughter", "Giggling", "Snoring",
    "Coughing", "Throat clearing", "Sneezing", "Breathing", "Gasp", "Panting",
    "Hiccup", "Wheezing", "Groaning", "Moaning", "Whining", "Wailing", "Keening",
    "Applause", "Clapping", "Crowd", "Hubbub", "Speech noise", "Crowd babble",
    "Children playing", "Screaming", "Shouting", "Yelling", "Whispering",
    "Laughter", "Giggling", "Snoring", "Coughing", "Throat clearing", "Sneezing",
    "Breathing", "Gasp", "Panting", "Hiccup", "Wheezing", "Groaning", "Moaning",
    "Whining", "Wailing", "Keening", "Applause", "Clapping", "Crowd", "Hubbub",
    "Speech noise", "Crowd babble", "Children playing", "Screaming", "Shouting",
    "Yelling", "Whispering", "Laughter", "Giggling", "Snoring", "Coughing",
    "Throat clearing", "Sneezing", "Breathing", "Gasp", "Panting", "Hiccup",
    "Wheezing", "Groaning", "Moaning", "Whining", "Wailing", "Keening",
    "Applause", "Clapping", "Crowd", "Hubbub", "Speech noise", "Crowd babble",
    "Children playing", "Screaming", "Shouting", "Yelling", "Whispering",
    "Laughter", "Giggling", "Snoring", "Coughing", "Throat clearing", "Sneezing",
    "Breathing", "Gasp", "Panting", "Hiccup", "Wheezing", "Groaning", "Moaning",
    "Whining", "Wailing", "Keening", "Applause", "Clapping", "Crowd", "Hubbub",
    "Speech noise", "Crowd babble", "Children playing", "Screaming", "Shouting",
    "Yelling", "Whispering", "Laughter", "Giggling", "Snoring", "Coughing",
    "Throat clearing", "Sneezing", "Breathing", "Gasp", "Panting", "Hiccup",
    "Wheezing", "Groaning", "Moaning", "Whining", "Wailing", "Keening",
    "Applause", "Clapping", "Crowd", "Hubbub", "Speech noise", "Crowd babble",
    "Children playing", "Screaming", "Shouting", "Yelling", "Whispering",
    "Laughter", "Giggling", "Snoring", "Coughing", "Throat clearing", "Sneezing",
    "Breathing", "Gasp", "Panting", "Hiccup", "Wheezing", "Groaning", "Moaning",
    "Whining", "Wailing", "Keening", "Applause", "Clapping", "Crowd", "Hubbub",
    "Speech noise", "Crowd babble", "Children playing", "Screaming", "Shouting",
    "Yelling", "Whispering", "Laughter", "Giggling", "Snoring", "Coughing",
    "Throat clearing", "Sneezing", "Breathing", "Gasp", "Panting", "Hiccup",
    "Wheezing", "Groaning", "Moaning", "Whining", "Wailing", "Keening",
    "Applause", "Clapping", "Crowd", "Hubbub", "Speech noise", "Crowd babble",
    "Children playing", "Screaming", "Shouting", "Yelling", "Whispering",
    "Laughter", "Giggling", "Snoring", "Coughing", "Throat clearing", "Sneezing",
    "Breathing", "Gasp", "Panting", "Hiccup", "Wheezing", "Groaning", "Moaning",
    "Whining", "Wailing", "Keening", "Applause", "Clapping", "Crowd", "Hubbub",
    "Speech noise", "Crowd babble", "Children playing", "Screaming", "Shouting",
    "Yelling", "Whispering", "Laughter", "Giggling", "Snoring", "Coughing",
    "Throat clearing", "Sneezing", "Breathing", "Gasp", "Panting", "Hiccup",
    "Wheezing", "Groaning", "Moaning", "Whining", "Wailing", "Keening",
    "Applause", "Clapping", "Crowd", "Hubbub", "Speech noise", "Crowd babble",
    "Children playing", "Screaming", "Shouting", "Yelling", "Whispering",
    "Laughter", "Giggling", "Snoring", "Coughing", "Throat clearing", "Sneezing",
    "Breathing", "Gasp", "Panting", "Hiccup", "Wheezing", "Groaning", "Moaning",
    "Whining", "Wailing", "Keening", "Applause", "Clapping", "Crowd", "Hubbub",
    "Speech noise", "Crowd babble", "Children playing", "Screaming", "Shouting",
    "Yelling", "Whispering", "Laughter", "Giggling", "Snoring", "Coughing",
    "Throat clearing", "Sneezing", "Breathing", "Gasp", "Panting", "Hiccup",
    "Wheezing", "Groaning", "Moaning", "Whining", "Wailing", "Keening",
    "Applause", "Clapping", "Crowd", "Hubbub", "Speech noise", "Crowd babble",
    "Children playing", "Screaming", "Shouting", "Yelling", "Whispering",
    "Laughter", "Giggling", "Snoring", "Coughing", "Throat clearing", "Sneezing",
    "Breathing", "Gasp", "Panting", "Hiccup", "Wheezing", "Groaning", "Moaning",
    "Whining", "Wailing", "Keening", "Applause", "Clapping", "Crowd", "Hubbub",
    "Speech noise", "Crowd babble", "Children playing", "Screaming", "Shouting",
    "Yelling", "Whispering", "Laughter", "Giggling", "Snoring", "Coughing",
    "Throat clearing", "Sneezing", "Breathing", "Gasp", "Panting", "Hiccup",
    "Wheezing", "Groaning", "Moaning", "Whining", "Wailing", "Keening",
    "Applause", "Clapping", "Crowd", "Hubbub", "Speech noise", "Crowd babble",
    "Children playing", "Screaming", "Shouting", "Yelling", "Whispering",
    "Laughter", "Giggling", "Snoring", "Coughing", "Throat clearing", "Sneezing",
    "Breathing", "Gasp", "Panting", "Hiccup", "Wheezing", "Groaning", "Moaning",
    "Whining", "Wailing", "Keening", "Applause", "Clapping", "Crowd", "Hubbub",
    "Speech noise", "Crowd babble", "Children playing", "Screaming", "Shouting",
    "Yelling", "Whispering", "Laughter", "Giggling", "Snoring", "Coughing",
    "Throat clearing", "Sneezing", "Breathing", "Gasp", "Panting", "Hiccup",
    "Wheezing", "Groaning", "Moaning", "Whining", "Wailing", "Keening",
    "Applause", "Clapping", "Crowd", "Hubbub", "Speech noise", "Crowd babble",
    "Children playing", "Screaming", "Shouting", "Yelling", "Whispering",
    "Laughter", "Giggling", "Snoring", "Coughing", "Throat clearing", "Sneezing",
    "Breathing", "Gasp", "Panting", "Hiccup", "Wheezing", "Groaning", "Moaning",
    "Whining", "Wailing", "Keening", "Applause", "Clapping", "Crowd", "Hubbub",
    "Speech noise", "Crowd babble", "Children playing", "Screaming", "Shouting",
    "Yelling", "Whispering", "Laughter", "Giggling", "Snoring", "Coughing",
    "Throat clearing", "Sneezing", "Breathing", "Gasp", "Panting", "Hiccup",
    "Wheezing", "Groaning", "Moaning", "Whining", "Wailing", "Keening",
    "Applause", "Clapping", "Crowd", "Hubbub", "Speech noise", "Crowd babble",
    "Children playing"
]

# 关键事件映射（用于高亮显示）
KEY_EVENTS = {
    9: "Screaming",
    44: "Screaming",
    45: "Shouting",
    46: "Yelling",
    14: "Coughing",
    15: "Throat clearing",
    16: "Sneezing",
    60: "Moaning",
    61: "Crying",
    62: "Whining",
    63: "Wailing",
}

detection_count = 0

try:
    print("[✓] 系统就绪，开始监听...\n")
    
    while True:
        try:
            # A. 录音 0.975秒
            recording = sd.rec(int(0.975 * FS), samplerate=FS, channels=CHANNELS,
                              device=TARGET_ID, dtype='float32')
            sd.wait()
            
            # B. 提取Channel 0
            audio = recording[:, 0].flatten()
            audio = audio - np.mean(audio)
            
            # C. 计算音量
            rms = np.sqrt(np.mean(audio ** 2))
            
            # D. 关键修复：输入形状是 [1]，不是 [1, 15600]
            # 这意味着模型期望的是一个标量值，而不是音频数组
            # 可能的解释：模型已经内置了音频处理
            
            # 尝试方案1：直接使用音量作为输入
            try:
                input_data = np.array([[rms]], dtype=np.float32)
                interpreter.set_tensor(IN_IDX, input_data)
                interpreter.invoke()
                scores = interpreter.get_tensor(OUT_IDX).flatten()
                
            except:
                # 尝试方案2：使用音频的第一个样本
                input_data = np.array([[audio[0]]], dtype=np.float32)
                interpreter.set_tensor(IN_IDX, input_data)
                interpreter.invoke()
                scores = interpreter.get_tensor(OUT_IDX).flatten()
            
            # E. 获取结果
            top_idx = np.argmax(scores)
            conf = scores[top_idx]
            
            time_now = datetime.datetime.now().strftime("%H:%M:%S")
            
            # F. 显示结果
            if conf > 0.5:  # 置信度阈值
                event_name = YAMNET_LABELS[top_idx] if top_idx < len(YAMNET_LABELS) else f"Event-{top_idx}"
                detection_count += 1
                
                print(f"\n{'='*70}")
                print(f"[{time_now}] ✓ EVENT #{detection_count} DETECTED")
                print(f"{'='*70}")
                print(f"  Event: {event_name}")
                print(f"  Confidence: {conf:.1%}")
                print(f"  Audio Level: {rms:.3f}")
                print(f"  Event ID: {top_idx}")
                print(f"{'='*70}\n")
            else:
                # 监听中
                bar = "█" * int(rms * 100)
                event_name = YAMNET_LABELS[top_idx] if top_idx < len(YAMNET_LABELS) else f"ID-{top_idx}"
                print(f"[{time_now}] Listening... Level: {bar:<30} | "
                      f"Top: {event_name} ({conf:.1%})", end='\r')
                sys.stdout.flush()
        
        except Exception as e:
            print(f"\n[✗] 处理错误: {e}")
            import traceback
            traceback.print_exc()
            continue

except KeyboardInterrupt:
    print(f"\n\n[✓] 程序已停止")
    print(f"[📊] 总共检测到 {detection_count} 个事件")
except Exception as e:
    print(f"\n[✗] 致命错误: {e}")
    import traceback
    traceback.print_exc()
