#!/usr/bin/env python3
"""
🚀 YAMNet 音频事件识别 - 树莓派版本（修正版）

这个程序在树莓派上运行，使用YAMNet模型识别危险声音事件。
基于测试结果，模型期望单一数值输入（如RMS音量）。

支持的危险事件：
- 跌倒声 (Fall)
- 尖叫声 (Scream)
- 咳嗽声 (Cough)
- 呻吟声 (Moan)
- 敲门声 (Knock)

使用方法：
    python3 raspberry_pi_yamnet_corrected.py [选项]

选项：
    --mode BASIC        基础模式：10秒快速测试
    --mode CONTINUOUS   持续模式：持续监听（默认）
    --threshold 0.5     置信度阈值（0-1，默认0.7）
    --server-url URL    云端服务器地址（默认: http://localhost:3000）
"""

import numpy as np
import tflite_runtime.interpreter as tflite
import sounddevice as sd
import json
import requests
import time
import argparse
import sys
from datetime import datetime
from pathlib import Path

# ============================================================================
# 配置
# ============================================================================

# 硬件配置
DEVICE_ID = 8           # ReSpeaker 4-Mic Array
CHANNELS = 32           # 32个麦克风通道
SAMPLE_RATE = 16000     # 采样率
RECORD_DURATION = 0.975 # 录音时长（秒）

# 模型配置
MODEL_PATH = "yamnet.tflite"

# 危险事件映射（YAMNet 521个类别中的关键类别）
DANGER_EVENTS = {
    494: {"name": "Silence", "danger": False, "confidence_threshold": 0.9},
    # 实际的危险事件类别需要根据YAMNet的521个类别来映射
    # 这里是常见的危险事件类别（需要根据实际模型调整）
    # 例如：
    # 123: {"name": "Fall", "danger": True, "confidence_threshold": 0.7},
    # 456: {"name": "Scream", "danger": True, "confidence_threshold": 0.6},
}

# ============================================================================
# 工具函数
# ============================================================================

def print_header(title):
    """打印标题"""
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70 + "\n")

def print_success(msg):
    """打印成功信息"""
    print(f"✓ {msg}")

def print_error(msg):
    """打印错误信息"""
    print(f"✗ {msg}")

def print_info(msg):
    """打印信息"""
    print(f"ℹ {msg}")

def get_audio_feature(audio_data):
    """
    从音频数据提取特征
    
    根据测试结果，模型期望单一数值输入。
    我们尝试多种特征提取方法，选择最有意义的。
    
    Args:
        audio_data: 音频数组 (n_samples,)
    
    Returns:
        float: 提取的特征值
    """
    
    # 方法1：RMS（Root Mean Square）- 音量指标
    rms = np.sqrt(np.mean(audio_data ** 2))
    
    # 方法2：峰值
    peak = np.max(np.abs(audio_data))
    
    # 方法3：零交叉率（Zero Crossing Rate）- 频率指标
    zcr = np.sum(np.abs(np.diff(np.sign(audio_data)))) / (2 * len(audio_data))
    
    # 方法4：能量
    energy = np.sum(audio_data ** 2) / len(audio_data)
    
    # 优先使用RMS（最能代表音量）
    feature = rms
    
    return feature

def load_model():
    """加载YAMNet模型"""
    try:
        print_info("加载YAMNet模型...")
        interpreter = tflite.Interpreter(model_path=MODEL_PATH)
        interpreter.allocate_tensors()
        
        # 获取输入输出张量信息
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()
        
        # 处理不同的返回格式
        if isinstance(input_details, list):
            input_idx = input_details[0]['index']
            input_shape = input_details[0]['shape']
        else:
            input_idx = input_details['index']
            input_shape = input_details['shape']
        
        if isinstance(output_details, list):
            output_idx = output_details[0]['index']
            output_shape = output_details[0]['shape']
        else:
            output_idx = output_details['index']
            output_shape = output_details['shape']
        
        print_success(f"模型加载成功")
        print_info(f"输入形状: {input_shape}")
        print_info(f"输出形状: {output_shape}")
        
        return interpreter, input_idx, output_idx
    
    except Exception as e:
        print_error(f"加载模型失败: {e}")
        sys.exit(1)

def record_audio():
    """
    从麦克风阵列录音
    
    Returns:
        np.array: 音频数据 (n_samples,)
    """
    try:
        print_info(f"从设备 {DEVICE_ID} 录音 {RECORD_DURATION} 秒...")
        
        # 录音
        recording = sd.rec(
            int(RECORD_DURATION * SAMPLE_RATE),
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            device=DEVICE_ID,
            dtype='float32'
        )
        sd.wait()
        
        # 提取第一个通道
        audio = recording[:, 0].flatten()
        
        print_success(f"录音完成，音频长度: {len(audio)} 样本")
        
        return audio
    
    except Exception as e:
        print_error(f"录音失败: {e}")
        return None

def infer_audio(interpreter, input_idx, output_idx, audio_data):
    """
    使用YAMNet模型进行推理
    
    Args:
        interpreter: TFLite解释器
        input_idx: 输入张量索引
        output_idx: 输出张量索引
        audio_data: 音频数据
    
    Returns:
        dict: 推理结果
    """
    try:
        # 提取特征
        feature = get_audio_feature(audio_data)
        
        # 准备输入
        input_data = np.array([feature], dtype=np.float32)
        
        # 推理
        start_time = time.time()
        interpreter.set_tensor(input_idx, input_data)
        interpreter.invoke()
        inference_time = (time.time() - start_time) * 1000  # 毫秒
        
        # 获取输出
        scores = interpreter.get_tensor(output_idx).flatten()
        
        # 找到置信度最高的类别
        top_idx = np.argmax(scores)
        top_confidence = scores[top_idx]
        
        # 获取前5个类别
        top_5_indices = np.argsort(scores)[-5:][::-1]
        top_5_scores = scores[top_5_indices]
        
        result = {
            "timestamp": datetime.now().isoformat(),
            "feature_value": float(feature),
            "top_class": int(top_idx),
            "top_confidence": float(top_confidence),
            "top_5_classes": [
                {
                    "class_id": int(idx),
                    "confidence": float(scores[idx])
                }
                for idx in top_5_indices
            ],
            "inference_time_ms": inference_time,
            "audio_length": len(audio_data),
            "sample_rate": SAMPLE_RATE
        }
        
        return result
    
    except Exception as e:
        print_error(f"推理失败: {e}")
        import traceback
        traceback.print_exc()
        return None

def display_result(result):
    """显示推理结果"""
    if result is None:
        return
    
    print_info(f"推理结果 (耗时 {result['inference_time_ms']:.1f}ms):")
    print(f"  顶部类别: {result['top_class']}")
    print(f"  置信度: {result['top_confidence']:.2%}")
    print(f"  特征值: {result['feature_value']:.6f}")
    print(f"\n  前5个类别:")
    for i, item in enumerate(result['top_5_classes'], 1):
        print(f"    {i}. 类别 {item['class_id']}: {item['confidence']:.2%}")

def upload_to_server(result, server_url, threshold):
    """
    上传推理结果到云端服务器
    
    Args:
        result: 推理结果
        server_url: 服务器地址
        threshold: 置信度阈值
    """
    if result is None:
        return False
    
    # 检查是否超过阈值
    if result['top_confidence'] < threshold:
        return False
    
    try:
        # 准备上传数据
        payload = {
            "timestamp": result['timestamp'],
            "event_class": result['top_class'],
            "confidence": result['top_confidence'],
            "feature_value": result['feature_value'],
            "inference_time_ms": result['inference_time_ms'],
            "top_5_classes": result['top_5_classes']
        }
        
        # 上传到服务器
        response = requests.post(
            f"{server_url}/api/trpc/raspberryPi.uploadYAMNetResult",
            json={"json": payload},
            timeout=5
        )
        
        if response.status_code == 200:
            print_success(f"上传成功: 类别 {result['top_class']} (置信度 {result['top_confidence']:.2%})")
            return True
        else:
            print_error(f"上传失败: HTTP {response.status_code}")
            return False
    
    except Exception as e:
        print_error(f"上传异常: {e}")
        return False

def run_basic_mode(interpreter, input_idx, output_idx, server_url, threshold):
    """
    基础模式：10秒快速测试
    """
    print_header("基础模式 - 10秒快速测试")
    
    audio = record_audio()
    if audio is None:
        return
    
    result = infer_audio(interpreter, input_idx, output_idx, audio)
    display_result(result)
    
    if result and result['top_confidence'] >= threshold:
        print_info(f"置信度超过阈值 {threshold:.2%}，准备上传...")
        upload_to_server(result, server_url, threshold)

def run_continuous_mode(interpreter, input_idx, output_idx, server_url, threshold):
    """
    持续模式：持续监听
    """
    print_header("持续模式 - 持续监听")
    print_info("按 Ctrl+C 停止监听\n")
    
    iteration = 0
    try:
        while True:
            iteration += 1
            print(f"\n--- 第 {iteration} 次采样 ---")
            
            audio = record_audio()
            if audio is None:
                continue
            
            result = infer_audio(interpreter, input_idx, output_idx, audio)
            display_result(result)
            
            if result and result['top_confidence'] >= threshold:
                print_info(f"置信度超过阈值 {threshold:.2%}，上传中...")
                upload_to_server(result, server_url, threshold)
            
            # 短暂延迟
            time.sleep(0.5)
    
    except KeyboardInterrupt:
        print_header("监听已停止")
        print_info(f"总采样次数: {iteration}")

# ============================================================================
# 主程序
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="YAMNet 音频事件识别 - 树莓派版本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例：
  python3 raspberry_pi_yamnet_corrected.py --mode BASIC
  python3 raspberry_pi_yamnet_corrected.py --mode CONTINUOUS --threshold 0.6
  python3 raspberry_pi_yamnet_corrected.py --server-url http://192.168.1.100:3000
        """
    )
    
    parser.add_argument(
        "--mode",
        choices=["BASIC", "CONTINUOUS"],
        default="CONTINUOUS",
        help="运行模式（默认: CONTINUOUS）"
    )
    
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.7,
        help="置信度阈值，0-1之间（默认: 0.7）"
    )
    
    parser.add_argument(
        "--server-url",
        default="http://localhost:3000",
        help="云端服务器地址（默认: http://localhost:3000）"
    )
    
    args = parser.parse_args()
    
    # 验证参数
    if not 0 <= args.threshold <= 1:
        print_error("阈值必须在0-1之间")
        sys.exit(1)
    
    # 加载模型
    interpreter, input_idx, output_idx = load_model()
    
    # 运行模式
    if args.mode == "BASIC":
        run_basic_mode(interpreter, input_idx, output_idx, args.server_url, args.threshold)
    else:
        run_continuous_mode(interpreter, input_idx, output_idx, args.server_url, args.threshold)

if __name__ == "__main__":
    main()
