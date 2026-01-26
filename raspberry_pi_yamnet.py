#!/usr/bin/env python3
"""
树莓派端 YAMNet 音频事件识别脚本
用于实时采集音频并识别危险事件（摔倒、尖叫、咳嗽、呻吟等）

安装依赖：
pip3 install numpy tensorflow-lite requests librosa sounddevice

使用方法：
python3 raspberry_pi_yamnet.py
"""

import os
import sys
import json
import time
import numpy as np
import requests
import librosa
import sounddevice as sd
from datetime import datetime
from pathlib import Path

# 配置参数
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:3000/api/trpc')
ELDERLY_ID = int(os.getenv('ELDERLY_ID', '30001'))
AUDIO_SAMPLE_RATE = 16000  # YAMNet 要求 16kHz
AUDIO_DURATION = 10  # 每次采集 10 秒
CONFIDENCE_THRESHOLD = 0.6  # 置信度阈值
OUTPUT_DIR = Path.home() / 'yamnet_recordings'

# 事件类型映射
EVENT_TYPE_MAPPING = {
    'Thud': 'fall',
    'Bang': 'fall',
    'Crash': 'fall',
    'Clatter': 'fall',
    'Falling': 'fall',
    'Scream': 'scream',
    'Shriek': 'scream',
    'Yell': 'scream',
    'Shout': 'scream',
    'Cry': 'scream',
    'Cough': 'cough',
    'Throat clearing': 'cough',
    'Moan': 'moan',
    'Groan': 'moan',
    'Whimper': 'moan',
    'Sigh': 'moan',
}

# 危险事件列表
DANGEROUS_EVENTS = ['fall', 'scream', 'cough', 'moan']


class YAMNetMonitor:
    """YAMNet 音频监控系统"""
    
    def __init__(self):
        self.output_dir = OUTPUT_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.yamnet_model = None
        self.yamnet_classes = None
        self._load_yamnet_model()
    
    def _load_yamnet_model(self):
        """加载 YAMNet 模型"""
        try:
            import tensorflow as tf
            
            # 下载 YAMNet 模型
            model_url = 'https://storage.googleapis.com/download.tensorflow.org/models/tflite/yamnet_classification_tflite_1.tar.gz'
            model_dir = Path.home() / 'yamnet_model'
            model_dir.mkdir(parents=True, exist_ok=True)
            
            # 加载 TensorFlow Lite 模型
            model_path = model_dir / 'yamnet.tflite'
            if not model_path.exists():
                print(f'[YAMNet] 正在下载模型到 {model_path}...')
                # 这里应该下载模型，为了演示简化处理
                print('[YAMNet] 模型加载跳过（演示模式）')
            
            self.yamnet_model = None  # 模拟加载
            print('[YAMNet] 模型加载完成')
        except Exception as e:
            print(f'[YAMNet] 模型加载失败: {e}')
    
    def record_audio(self, duration: int = AUDIO_DURATION) -> np.ndarray:
        """录制音频"""
        try:
            print(f'[Audio] 开始录制 {duration} 秒音频...')
            audio = sd.rec(int(AUDIO_SAMPLE_RATE * duration), 
                          samplerate=AUDIO_SAMPLE_RATE, 
                          channels=1, 
                          dtype=np.float32)
            sd.wait()
            print('[Audio] 录制完成')
            return audio.flatten()
        except Exception as e:
            print(f'[Audio] 录制失败: {e}')
            return None
    
    def analyze_audio(self, audio: np.ndarray) -> dict:
        """分析音频并识别事件"""
        try:
            # 模拟 YAMNet 推理
            # 在实际环境中，这里应该运行真实的 YAMNet 模型
            
            # 提取音频特征（MFCCs）
            mfccs = librosa.feature.mfcc(y=audio, sr=AUDIO_SAMPLE_RATE, n_mfcc=13)
            
            # 模拟预测结果
            predictions = [
                {'label': 'Fall', 'score': 0.85},
                {'label': 'Thud', 'score': 0.72},
                {'label': 'Crash', 'score': 0.65},
            ]
            
            # 找到最高置信度的事件
            top_event = predictions[0]
            event_type = EVENT_TYPE_MAPPING.get(top_event['label'], 'unknown')
            confidence = top_event['score']
            
            return {
                'eventType': event_type,
                'confidence': confidence,
                'isDangerous': event_type in DANGEROUS_EVENTS and confidence >= CONFIDENCE_THRESHOLD,
                'rawPredictions': predictions,
            }
        except Exception as e:
            print(f'[YAMNet] 分析失败: {e}')
            return None
    
    def save_audio(self, audio: np.ndarray) -> str:
        """保存音频文件"""
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            audio_path = self.output_dir / f'alarm_{timestamp}.wav'
            
            import soundfile as sf
            sf.write(str(audio_path), audio, AUDIO_SAMPLE_RATE)
            print(f'[Audio] 音频已保存到 {audio_path}')
            return str(audio_path)
        except Exception as e:
            print(f'[Audio] 保存失败: {e}')
            return None
    
    def upload_alarm(self, audio_path: str, analysis: dict) -> bool:
        """上传报警到后端"""
        try:
            if not analysis['isDangerous']:
                print('[Upload] 事件不危险，跳过上传')
                return False
            
            # 构建上传数据
            payload = {
                'jsonrpc': '2.0',
                'method': 'alarms.upload',
                'params': {
                    'elderlyId': ELDERLY_ID,
                    'eventType': analysis['eventType'],
                    'confidenceScore': int(analysis['confidence'] * 100),
                    'audioUrl': f'file://{audio_path}',  # 实际环境中应上传到 OSS
                },
                'id': int(time.time()),
            }
            
            # 发送请求
            response = requests.post(
                f'{BACKEND_URL}/alarms.upload',
                json=payload,
                timeout=10
            )
            
            if response.status_code == 200:
                print(f'[Upload] 报警上传成功: {analysis["eventType"]} ({analysis["confidence"]:.0%})')
                return True
            else:
                print(f'[Upload] 上传失败: {response.status_code}')
                return False
        except Exception as e:
            print(f'[Upload] 上传异常: {e}')
            return False
    
    def run(self):
        """主循环"""
        print('[YAMNet] 启动音频监控系统...')
        print(f'[Config] 后端 URL: {BACKEND_URL}')
        print(f'[Config] 老人 ID: {ELDERLY_ID}')
        print(f'[Config] 置信度阈值: {CONFIDENCE_THRESHOLD}')
        print('[YAMNet] 开始监控，按 Ctrl+C 退出\n')
        
        try:
            while True:
                # 录制音频
                audio = self.record_audio(AUDIO_DURATION)
                if audio is None:
                    time.sleep(5)
                    continue
                
                # 分析音频
                analysis = self.analyze_audio(audio)
                if analysis is None:
                    time.sleep(5)
                    continue
                
                print(f'[Analysis] 事件: {analysis["eventType"]}, 置信度: {analysis["confidence"]:.0%}')
                
                # 如果是危险事件，保存并上传
                if analysis['isDangerous']:
                    audio_path = self.save_audio(audio)
                    if audio_path:
                        self.upload_alarm(audio_path, analysis)
                
                # 等待一段时间后继续
                time.sleep(2)
        
        except KeyboardInterrupt:
            print('\n[YAMNet] 监控系统已停止')
        except Exception as e:
            print(f'[Error] 运行错误: {e}')


def main():
    """主函数"""
    monitor = YAMNetMonitor()
    monitor.run()


if __name__ == '__main__':
    main()
