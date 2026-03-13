#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
小羊养老树莓派上传客户端
将YAMNet推理结果上传到云端系统

使用方法：
    python3 raspberry_pi_uploader.py --config config.yaml
"""

import argparse
import json
import time
import logging
import requests
import yaml
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from collections import deque
import threading
import queue
from enum import Enum

# ============================================================================
# 配置和常量
# ============================================================================

class EventType(Enum):
    """事件类型"""
    DANGER = "danger"      # 危险信号（需要立即响应）
    HEALTH = "health"      # 健康信号（需要关注）
    NORMAL = "normal"      # 日常声音（正常情况）

# YAMNet类别到中文事件的映射
YAMNET_CLASS_MAPPING = {
    # 危险信号
    123: ("尖叫", EventType.DANGER),
    456: ("呼救", EventType.DANGER),
    789: ("摔倒", EventType.DANGER),
    234: ("撞击", EventType.DANGER),
    567: ("玻璃破碎", EventType.DANGER),
    
    # 健康信号
    111: ("咳嗽", EventType.HEALTH),
    222: ("打喷嚏", EventType.HEALTH),
    333: ("呻吟", EventType.HEALTH),
    444: ("喘息", EventType.HEALTH),
    555: ("打鼾", EventType.HEALTH),
    666: ("哭泣", EventType.HEALTH),
    
    # 日常声音
    1: ("说话", EventType.NORMAL),
    2: ("背景噪音", EventType.NORMAL),
    3: ("呼吸", EventType.NORMAL),
}

# ============================================================================
# 数据类
# ============================================================================

@dataclass
class InferenceResult:
    """YAMNet推理结果"""
    class_id: int
    class_name: str
    confidence: float
    
    def to_dict(self):
        return asdict(self)

@dataclass
class AudioChunk:
    """音频块信息"""
    duration: int  # 秒
    sample_rate: int  # Hz
    
    def to_dict(self):
        return asdict(self)

@dataclass
class UploadData:
    """上传数据"""
    device_id: str
    elderly_id: str
    timestamp: int  # 毫秒
    audio_chunk: Dict
    inference_results: List[Dict]
    
    def to_dict(self):
        return {
            'device_id': self.device_id,
            'elderly_id': self.elderly_id,
            'timestamp': self.timestamp,
            'audio_chunk': self.audio_chunk,
            'inference_results': self.inference_results
        }

# ============================================================================
# 配置管理
# ============================================================================

class Config:
    """配置管理"""
    
    def __init__(self, config_path: str = None):
        """加载配置"""
        self.config_path = config_path or Path.home() / 'xiaoyanglaoyao' / 'config.yaml'
        self.config = self._load_config()
    
    def _load_config(self) -> Dict:
        """加载配置文件"""
        if not Path(self.config_path).exists():
            return self._get_default_config()
        
        with open(self.config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f) or {}
    
    def _get_default_config(self) -> Dict:
        """获取默认配置"""
        return {
            'device': {
                'device_id': 'raspberry_pi_001',
                'device_token': 'your_device_token_here',
            },
            'elderly': {
                'elderly_id': 'elder_001',
                'name': '老人名字',
            },
            'server': {
                'url': 'https://your-domain.manus.space',
                'api_endpoint': '/api/trpc/raspberryPi.uploadInference',
            },
            'upload': {
                'interval': 10,  # 秒
                'max_retries': 3,
                'retry_delay': 5,  # 秒
                'cache_size': 100,
            },
            'inference': {
                'confidence_threshold': 0.5,
                'top_k': 3,
            }
        }
    
    def get(self, key: str, default=None):
        """获取配置值"""
        keys = key.split('.')
        value = self.config
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
            else:
                return default
        return value if value is not None else default

# ============================================================================
# 日志管理
# ============================================================================

class Logger:
    """日志管理"""
    
    def __init__(self, name: str, log_dir: str = None):
        """初始化日志"""
        self.log_dir = Path(log_dir or Path.home() / 'xiaoyanglaoyao' / 'logs')
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.DEBUG)
        
        # 文件处理器
        fh = logging.FileHandler(self.log_dir / f'{name}.log')
        fh.setLevel(logging.DEBUG)
        
        # 控制台处理器
        ch = logging.StreamHandler()
        ch.setLevel(logging.INFO)
        
        # 格式化器
        formatter = logging.Formatter(
            '[%(asctime)s] %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        fh.setFormatter(formatter)
        ch.setFormatter(formatter)
        
        self.logger.addHandler(fh)
        self.logger.addHandler(ch)
    
    def info(self, msg):
        self.logger.info(msg)
    
    def error(self, msg):
        self.logger.error(msg)
    
    def debug(self, msg):
        self.logger.debug(msg)
    
    def warning(self, msg):
        self.logger.warning(msg)

# ============================================================================
# 上传客户端
# ============================================================================

class YAMNetUploader:
    """YAMNet推理结果上传客户端"""
    
    def __init__(self, config: Config):
        """初始化上传客户端"""
        self.config = config
        self.logger = Logger('uploader')
        
        # 配置参数
        self.device_id = config.get('device.device_id')
        self.device_token = config.get('device.device_token')
        self.elderly_id = config.get('elderly.elderly_id')
        self.server_url = config.get('server.url')
        self.api_endpoint = config.get('server.api_endpoint')
        self.upload_interval = config.get('upload.interval', 10)
        self.max_retries = config.get('upload.max_retries', 3)
        self.retry_delay = config.get('upload.retry_delay', 5)
        self.cache_size = config.get('upload.cache_size', 100)
        self.confidence_threshold = config.get('inference.confidence_threshold', 0.5)
        self.top_k = config.get('inference.top_k', 3)
        
        # 本地缓存
        self.cache = deque(maxlen=self.cache_size)
        self.upload_queue = queue.Queue()
        
        # 统计信息
        self.stats = {
            'total_uploaded': 0,
            'total_failed': 0,
            'last_upload_time': None,
            'last_error': None,
        }
        
        self.logger.info(f"上传客户端初始化完成")
        self.logger.info(f"  设备ID: {self.device_id}")
        self.logger.info(f"  老人ID: {self.elderly_id}")
        self.logger.info(f"  服务器: {self.server_url}")
    
    def process_inference(self, raw_inference: Dict) -> Optional[UploadData]:
        """处理YAMNet推理结果"""
        try:
            # 提取推理结果
            inference_results = raw_inference.get('inference_results', {})
            
            # 获取置信度最高的结果
            top_results = []
            for key in ['top_1', 'top_2', 'top_3'][:self.top_k]:
                if key in inference_results:
                    result = inference_results[key]
                    class_id = result.get('class_id')
                    confidence = result.get('confidence', 0)
                    
                    # 过滤低置信度结果
                    if confidence >= self.confidence_threshold:
                        # 转换为中文事件名称
                        if class_id in YAMNET_CLASS_MAPPING:
                            chinese_name, event_type = YAMNET_CLASS_MAPPING[class_id]
                        else:
                            chinese_name = result.get('class_name', f'Unknown_{class_id}')
                            event_type = EventType.NORMAL
                        
                        top_results.append({
                            'class_id': class_id,
                            'class_name': chinese_name,
                            'confidence': confidence,
                            'event_type': event_type.value,
                        })
            
            if not top_results:
                return None
            
            # 创建上传数据
            upload_data = UploadData(
                device_id=self.device_id,
                elderly_id=self.elderly_id,
                timestamp=int(time.time() * 1000),
                audio_chunk={
                    'duration': raw_inference.get('audio_chunk', {}).get('duration', 10),
                    'sample_rate': raw_inference.get('audio_chunk', {}).get('sample_rate', 16000),
                },
                inference_results=top_results,
            )
            
            return upload_data
        
        except Exception as e:
            self.logger.error(f"处理推理结果失败: {e}")
            return None
    
    def upload_inference(self, upload_data: UploadData) -> bool:
        """上传推理结果到云端"""
        try:
            # 准备请求头
            headers = {
                'Authorization': f'Bearer {self.device_token}',
                'Content-Type': 'application/json',
                'X-Device-ID': self.device_id,
            }
            
            # 准备请求体
            data = upload_data.to_dict()
            
            # 构建完整URL
            full_url = f"{self.server_url}{self.api_endpoint}"
            
            # 发送请求
            self.logger.debug(f"上传数据到 {full_url}")
            response = requests.post(
                full_url,
                json=data,
                headers=headers,
                timeout=10,
                verify=True
            )
            
            # 检查响应
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    self.logger.info(f"✓ 上传成功 - {upload_data.inference_results[0]['class_name']} ({upload_data.inference_results[0]['confidence']:.1%})")
                    self.stats['total_uploaded'] += 1
                    self.stats['last_upload_time'] = datetime.now()
                    return True
                else:
                    self.logger.warning(f"✗ 上传失败 - {result.get('message', '未知错误')}")
                    self.stats['total_failed'] += 1
                    self.stats['last_error'] = result.get('message')
                    return False
            else:
                self.logger.warning(f"✗ HTTP错误 - {response.status_code}")
                self.stats['total_failed'] += 1
                self.stats['last_error'] = f"HTTP {response.status_code}"
                return False
        
        except requests.exceptions.Timeout:
            self.logger.error("✗ 上传超时")
            self.stats['total_failed'] += 1
            self.stats['last_error'] = "Timeout"
            return False
        
        except requests.exceptions.ConnectionError:
            self.logger.error("✗ 网络连接失败")
            self.stats['total_failed'] += 1
            self.stats['last_error'] = "Connection Error"
            return False
        
        except Exception as e:
            self.logger.error(f"✗ 上传异常: {e}")
            self.stats['total_failed'] += 1
            self.stats['last_error'] = str(e)
            return False
    
    def upload_with_retry(self, upload_data: UploadData) -> bool:
        """带重试的上传"""
        for attempt in range(self.max_retries):
            if self.upload_inference(upload_data):
                return True
            
            if attempt < self.max_retries - 1:
                self.logger.info(f"重试中... ({attempt + 1}/{self.max_retries})")
                time.sleep(self.retry_delay)
        
        # 缓存失败的数据
        self.cache.append(upload_data)
        self.logger.warning(f"上传失败，已缓存数据 (缓存大小: {len(self.cache)})")
        return False
    
    def retry_cached_data(self):
        """重试缓存的数据"""
        while self.cache:
            upload_data = self.cache.popleft()
            if self.upload_inference(upload_data):
                self.logger.info(f"缓存数据上传成功")
            else:
                # 重新加入缓存
                self.cache.appendleft(upload_data)
                break
    
    def get_stats(self) -> Dict:
        """获取统计信息"""
        return {
            'device_id': self.device_id,
            'elderly_id': self.elderly_id,
            'total_uploaded': self.stats['total_uploaded'],
            'total_failed': self.stats['total_failed'],
            'cache_size': len(self.cache),
            'last_upload_time': self.stats['last_upload_time'].isoformat() if self.stats['last_upload_time'] else None,
            'last_error': self.stats['last_error'],
        }
    
    def print_stats(self):
        """打印统计信息"""
        stats = self.get_stats()
        print("\n" + "=" * 70)
        print("上传统计信息")
        print("=" * 70)
        print(f"设备ID:          {stats['device_id']}")
        print(f"老人ID:          {stats['elderly_id']}")
        print(f"成功上传:        {stats['total_uploaded']} 条")
        print(f"失败上传:        {stats['total_failed']} 条")
        print(f"缓存数据:        {stats['cache_size']} 条")
        print(f"最后上传时间:    {stats['last_upload_time'] or '未上传'}")
        print(f"最后错误:        {stats['last_error'] or '无'}")
        print("=" * 70 + "\n")

# ============================================================================
# 主程序
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='小羊养老树莓派上传客户端',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例：
  python3 raspberry_pi_uploader.py
  python3 raspberry_pi_uploader.py --config /path/to/config.yaml
  python3 raspberry_pi_uploader.py --test
        '''
    )
    
    parser.add_argument(
        '--config',
        type=str,
        help='配置文件路径'
    )
    
    parser.add_argument(
        '--test',
        action='store_true',
        help='测试模式（模拟推理结果）'
    )
    
    args = parser.parse_args()
    
    try:
        # 加载配置
        config = Config(args.config)
        
        # 初始化上传客户端
        uploader = YAMNetUploader(config)
        
        if args.test:
            # 测试模式
            print("\n" + "=" * 70)
            print("测试模式 - 模拟YAMNet推理结果上传")
            print("=" * 70 + "\n")
            
            # 模拟推理结果
            test_inferences = [
                {
                    'audio_chunk': {'duration': 10, 'sample_rate': 16000},
                    'inference_results': {
                        'top_1': {'class_id': 123, 'class_name': 'Scream', 'confidence': 0.92},
                        'top_2': {'class_id': 456, 'class_name': 'Shouting', 'confidence': 0.65},
                        'top_3': {'class_id': 789, 'class_name': 'Crying', 'confidence': 0.45},
                    }
                },
                {
                    'audio_chunk': {'duration': 10, 'sample_rate': 16000},
                    'inference_results': {
                        'top_1': {'class_id': 111, 'class_name': 'Cough', 'confidence': 0.88},
                        'top_2': {'class_id': 222, 'class_name': 'Sneeze', 'confidence': 0.55},
                    }
                },
            ]
            
            # 上传测试数据
            for i, raw_inference in enumerate(test_inferences, 1):
                print(f"\n[测试 {i}] 处理推理结果...")
                upload_data = uploader.process_inference(raw_inference)
                
                if upload_data:
                    print(f"  主要事件: {upload_data.inference_results[0]['class_name']}")
                    print(f"  置信度: {upload_data.inference_results[0]['confidence']:.1%}")
                    print(f"  上传中...")
                    uploader.upload_with_retry(upload_data)
                else:
                    print("  处理失败")
            
            # 打印统计信息
            uploader.print_stats()
        
        else:
            # 实际运行模式
            print("\n" + "=" * 70)
            print("小羊养老树莓派上传客户端 - 运行中")
            print("=" * 70)
            print(f"设备ID: {uploader.device_id}")
            print(f"老人ID: {uploader.elderly_id}")
            print(f"服务器: {uploader.server_url}")
            print(f"上传间隔: {uploader.upload_interval} 秒")
            print("\n按 Ctrl+C 停止程序\n")
            
            # 主循环
            try:
                while True:
                    # 这里应该从YAMNet推理程序读取数据
                    # 现在只是演示，实际应该集成到YAMNet推理程序中
                    
                    # 重试缓存的数据
                    uploader.retry_cached_data()
                    
                    time.sleep(uploader.upload_interval)
            
            except KeyboardInterrupt:
                print("\n\n[*] 程序已停止")
                uploader.print_stats()
    
    except Exception as e:
        print(f"[✗] 错误: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == '__main__':
    exit(main())
