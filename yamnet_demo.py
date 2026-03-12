#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
小羊养老YAMNet演示脚本
这个脚本展示了如何使用YAMNet进行实时音频分类

使用方法：
    python3 yamnet_demo.py --mode basic      # 基础演示
    python3 yamnet_demo.py --mode interactive # 交互式演示
    python3 yamnet_demo.py --mode file        # 文件分类演示
"""

import argparse
import numpy as np
import tensorflow as tf
import sounddevice as sd
import librosa
import json
from pathlib import Path
from datetime import datetime
from collections import deque
import time
import sys

# ============================================================================
# 配置
# ============================================================================

class Config:
    """YAMNet演示配置"""
    SAMPLE_RATE = 16000  # 采样率
    CHUNK_DURATION = 10  # 每个音频块的时长（秒）
    CHUNK_SIZE = SAMPLE_RATE * CHUNK_DURATION  # 样本数
    
    # 置信度阈值
    DANGER_THRESHOLD = 0.75  # 危险信号
    HEALTH_THRESHOLD = 0.65  # 健康信号
    NORMAL_THRESHOLD = 0.50  # 日常声音
    
    # 模型路径
    MODEL_PATH = Path.home() / 'xiaoyanglaoyao' / 'models' / 'yamnet.tflite'
    LABELS_PATH = Path.home() / 'xiaoyanglaoyao' / 'models' / 'yamnet_labels.txt'
    
    # 事件映射
    EVENT_MAPPING = {
        'Thud': ('跌倒', 'danger'),
        'Crash': ('撞击', 'danger'),
        'Scream': ('尖叫', 'danger'),
        'Shriek': ('尖叫', 'danger'),
        'Shouting': ('呼救', 'danger'),
        'Yelling': ('大声喊叫', 'danger'),
        'Crying': ('哭泣', 'health'),
        'Whimpering': ('呻吟', 'health'),
        'Moaning': ('呻吟', 'health'),
        'Cough': ('咳嗽', 'health'),
        'Sneeze': ('打喷嚏', 'health'),
        'Snoring': ('打鼾', 'health'),
        'Wheeze': ('喘息', 'health'),
        'Breathing': ('呼吸', 'health'),
    }

# ============================================================================
# YAMNet分类器
# ============================================================================

class YAMNetClassifier:
    """YAMNet音频分类器"""
    
    def __init__(self, model_path=Config.MODEL_PATH, labels_path=Config.LABELS_PATH):
        """初始化分类器"""
        print("[*] 加载YAMNet模型...")
        
        # 检查文件是否存在
        if not model_path.exists():
            raise FileNotFoundError(f"模型文件不存在: {model_path}")
        if not labels_path.exists():
            raise FileNotFoundError(f"标签文件不存在: {labels_path}")
        
        # 加载模型
        self.interpreter = tf.lite.Interpreter(model_path=str(model_path))
        self.interpreter.allocate_tensors()
        
        # 加载标签
        with open(labels_path, 'r') as f:
            self.labels = [line.strip() for line in f.readlines()]
        
        # 获取输入/输出详情
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        
        print(f"[✓] 模型加载成功")
        print(f"    - 模型大小: {len(self.labels)} 个事件分类")
        print(f"    - 采样率: {Config.SAMPLE_RATE} Hz")
        print(f"    - 块大小: {Config.CHUNK_DURATION} 秒")
    
    def classify(self, audio_data):
        """对音频数据进行分类"""
        # 确保音频长度正确
        if len(audio_data) < Config.CHUNK_SIZE:
            audio_data = np.pad(audio_data, (0, Config.CHUNK_SIZE - len(audio_data)))
        else:
            audio_data = audio_data[:Config.CHUNK_SIZE]
        
        # 标准化音频
        audio_data = audio_data.astype(np.float32)
        if np.std(audio_data) > 0:
            audio_data = (audio_data - np.mean(audio_data)) / np.std(audio_data)
        
        # 运行推理
        self.interpreter.set_tensor(
            self.input_details[0]['index'],
            audio_data
        )
        self.interpreter.invoke()
        
        # 获取输出
        scores = self.interpreter.get_tensor(self.output_details[0]['index'])
        return scores[0]
    
    def get_top_events(self, scores, top_k=5, threshold=0.5):
        """获取置信度最高的事件"""
        top_indices = np.argsort(scores)[-top_k:][::-1]
        
        results = []
        for idx in top_indices:
            confidence = float(scores[idx])
            if confidence >= threshold:
                event_name = self.labels[idx]
                
                # 映射到中文事件名
                chinese_name = event_name
                event_type = 'normal'
                if event_name in Config.EVENT_MAPPING:
                    chinese_name, event_type = Config.EVENT_MAPPING[event_name]
                
                results.append({
                    'event': event_name,
                    'chinese_name': chinese_name,
                    'confidence': confidence,
                    'type': event_type,
                    'index': int(idx)
                })
        
        return results
    
    def classify_file(self, audio_path):
        """对音频文件进行分类"""
        print(f"\n[*] 加载音频文件: {audio_path}")
        
        # 加载音频
        waveform, sr = librosa.load(audio_path, sr=Config.SAMPLE_RATE)
        print(f"[✓] 音频加载成功")
        print(f"    - 时长: {len(waveform) / Config.SAMPLE_RATE:.1f} 秒")
        print(f"    - 采样率: {sr} Hz")
        
        # 分割成10秒的块
        num_chunks = int(np.ceil(len(waveform) / Config.CHUNK_SIZE))
        print(f"    - 分割为 {num_chunks} 个块")
        
        print("\n" + "=" * 70)
        print("分类结果")
        print("=" * 70)
        
        all_results = []
        for i in range(num_chunks):
            start = i * Config.CHUNK_SIZE
            end = min((i + 1) * Config.CHUNK_SIZE, len(waveform))
            chunk = waveform[start:end]
            
            # 分类
            scores = self.classify(chunk)
            results = self.get_top_events(scores, top_k=3, threshold=0.5)
            
            # 显示结果
            timestamp = i * Config.CHUNK_DURATION
            print(f"\n[{timestamp:3d}s] 检测到的事件:")
            
            if results:
                for result in results:
                    confidence_bar = "█" * int(result['confidence'] * 20)
                    print(f"  • {result['chinese_name']:12s} {confidence_bar} {result['confidence']:.1%}")
                    all_results.append(result)
            else:
                print("  • 无显著事件")
        
        print("\n" + "=" * 70)
        return all_results

# ============================================================================
# 演示模式
# ============================================================================

class BasicDemo:
    """基础演示：对一个10秒的音频进行分类"""
    
    @staticmethod
    def run(classifier):
        print("\n" + "=" * 70)
        print("YAMNet基础演示 - 实时音频分类")
        print("=" * 70)
        print("\n这个演示会录制10秒的音频，然后进行分类。")
        print("请在麦克风前说话、咳嗽或制造声音...")
        print()
        
        # 录制音频
        print("[*] 开始录制（10秒）...")
        audio_data = sd.rec(
            Config.CHUNK_SIZE,
            samplerate=Config.SAMPLE_RATE,
            channels=1,
            dtype='float32'
        )
        
        # 显示进度
        for i in range(10):
            print(f"  [{i+1}/10] ", end='', flush=True)
            time.sleep(1)
        print("\n[✓] 录制完成")
        
        sd.wait()
        
        # 分类
        print("\n[*] 正在分析音频...")
        scores = classifier.classify(audio_data[:, 0])
        results = classifier.get_top_events(scores, top_k=5, threshold=0.5)
        
        # 显示结果
        print("\n" + "=" * 70)
        print("分类结果")
        print("=" * 70)
        
        if results:
            for result in results:
                confidence_bar = "█" * int(result['confidence'] * 20)
                event_type_emoji = {
                    'danger': '🔴',
                    'health': '🟠',
                    'normal': '🟡'
                }.get(result['type'], '⚪')
                
                print(f"{event_type_emoji} {result['chinese_name']:12s} {confidence_bar} {result['confidence']:.1%}")
        else:
            print("未检测到显著事件")
        
        print("=" * 70)


class InteractiveDemo:
    """交互式演示：持续监听并实时分类"""
    
    @staticmethod
    def run(classifier, duration=60):
        print("\n" + "=" * 70)
        print("YAMNet交互式演示 - 持续监听")
        print("=" * 70)
        print(f"\n这个演示会持续监听{duration}秒，并实时显示检测到的事件。")
        print("按 Ctrl+C 停止演示。\n")
        
        # 计算块数
        num_chunks = int(np.ceil(duration * Config.SAMPLE_RATE / Config.CHUNK_SIZE))
        
        print("[*] 开始监听...")
        print("-" * 70)
        
        try:
            for chunk_idx in range(num_chunks):
                # 录制一个块
                audio_data = sd.rec(
                    Config.CHUNK_SIZE,
                    samplerate=Config.SAMPLE_RATE,
                    channels=1,
                    dtype='float32'
                )
                sd.wait()
                
                # 分类
                scores = classifier.classify(audio_data[:, 0])
                results = classifier.get_top_events(scores, top_k=3, threshold=0.6)
                
                # 显示结果
                timestamp = chunk_idx * Config.CHUNK_DURATION
                print(f"\n[{timestamp:3d}s] {datetime.now().strftime('%H:%M:%S')}")
                
                if results:
                    for result in results:
                        event_type_emoji = {
                            'danger': '🔴',
                            'health': '🟠',
                            'normal': '🟡'
                        }.get(result['type'], '⚪')
                        
                        print(f"  {event_type_emoji} {result['chinese_name']:12s} {result['confidence']:.1%}")
                else:
                    print("  ⚪ 无显著事件")
        
        except KeyboardInterrupt:
            print("\n\n[*] 演示已停止")
        
        print("-" * 70)


class FileDemo:
    """文件演示：对音频文件进行分类"""
    
    @staticmethod
    def run(classifier, audio_path):
        classifier.classify_file(audio_path)


# ============================================================================
# 主函数
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='小羊养老YAMNet演示脚本',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例：
  python3 yamnet_demo.py --mode basic
  python3 yamnet_demo.py --mode interactive --duration 30
  python3 yamnet_demo.py --mode file --audio sample.wav
        '''
    )
    
    parser.add_argument(
        '--mode',
        choices=['basic', 'interactive', 'file'],
        default='basic',
        help='演示模式（默认：basic）'
    )
    
    parser.add_argument(
        '--duration',
        type=int,
        default=60,
        help='交互式演示的持续时间（秒，默认：60）'
    )
    
    parser.add_argument(
        '--audio',
        type=str,
        help='音频文件路径（用于file模式）'
    )
    
    parser.add_argument(
        '--device',
        type=int,
        help='音频设备ID（可选）'
    )
    
    args = parser.parse_args()
    
    try:
        # 初始化分类器
        classifier = YAMNetClassifier()
        
        # 运行选定的演示
        if args.mode == 'basic':
            BasicDemo.run(classifier)
        
        elif args.mode == 'interactive':
            InteractiveDemo.run(classifier, duration=args.duration)
        
        elif args.mode == 'file':
            if not args.audio:
                print("[✗] 错误：file模式需要指定--audio参数")
                sys.exit(1)
            FileDemo.run(classifier, args.audio)
    
    except FileNotFoundError as e:
        print(f"[✗] 错误: {e}")
        print("\n请确保已运行自动安装脚本：bash install_yamnet_auto.sh")
        sys.exit(1)
    
    except KeyboardInterrupt:
        print("\n[*] 程序已中断")
        sys.exit(0)
    
    except Exception as e:
        print(f"[✗] 发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
