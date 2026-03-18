#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
树莓派 YAMNet 声音监控客户端
=============================
本程序运行在树莓派上，使用 ReSpeaker 4-Mic 阵列采集声音，
通过 YAMNet 模型进行音频事件分类，检测到危险事件时自动上传到云端服务器。

硬件要求:
  - 树莓派 4B (推荐 4GB 内存)
  - ReSpeaker 4-Mic Array (设备ID通常为8)
  - 稳定的网络连接

软件依赖:
  pip3 install sounddevice numpy requests tflite-runtime

使用方法:
  python3 raspberry_pi_client.py --server-url https://your-server.com --device-id rpi-001 --api-token YOUR_TOKEN

作者: 小羊养老声音监控系统
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
# 配置
# ============================================================================

# YAMNet 模型参数
SAMPLE_RATE = 16000          # 采样率 16kHz
AUDIO_SAMPLES = 15600        # YAMNet 输入长度 (0.975秒)
RECORD_DURATION = 0.975      # 录音时长(秒)
RMS_THRESHOLD = 0.03         # RMS 音量阈值（过滤背景噪音）
CHANNELS = 1                 # 单声道（从32通道中取第一个）

# 危险事件类别ID (YAMNet 521个类别中的21个危险事件)
DANGER_CLASS_IDS = {
    6, 7, 9, 11, 19, 20, 22,        # 尖叫/呼救类
    33, 39, 42,                       # 咳嗽/健康类
    300, 301, 310, 315, 316,          # 摔倒/撞击类
    317, 390, 393, 394, 399,          # 呻吟/不适类
    420,                              # 报警类
}

# 心跳间隔
HEARTBEAT_INTERVAL = 60  # 秒

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('yamnet_client')


# ============================================================================
# YAMNet 模型加载
# ============================================================================

class YAMNetModel:
    """YAMNet TensorFlow Lite 模型封装"""

    def __init__(self, model_path='yamnet.tflite', class_map_path='yamnet_class_map.csv'):
        self.model_path = model_path
        self.class_map_path = class_map_path
        self.interpreter = None
        self.class_names = []
        self._load_model()
        self._load_class_map()

    def _load_model(self):
        """加载 TFLite 模型"""
        try:
            import tflite_runtime.interpreter as tflite
            self.interpreter = tflite.Interpreter(model_path=self.model_path)
            logger.info(f"YAMNet 模型已加载: {self.model_path}")
        except ImportError:
            try:
                import tensorflow as tf
                self.interpreter = tf.lite.Interpreter(model_path=self.model_path)
                logger.info(f"YAMNet 模型已加载 (TF): {self.model_path}")
            except ImportError:
                logger.error("请安装 tflite-runtime 或 tensorflow")
                sys.exit(1)

        # 调整输入张量大小为 [15600]
        input_details = self.interpreter.get_input_details()
        self.interpreter.resize_tensor_input(input_details[0]['index'], [AUDIO_SAMPLES])
        self.interpreter.allocate_tensors()

        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        logger.info(f"输入形状: {self.input_details[0]['shape']}")
        logger.info(f"输出数量: {len(self.output_details)}")

    def _load_class_map(self):
        """加载类别映射表"""
        if os.path.exists(self.class_map_path):
            with open(self.class_map_path, 'r') as f:
                lines = f.readlines()
                # 跳过标题行
                for line in lines[1:]:
                    parts = line.strip().split(',', 2)
                    if len(parts) >= 3:
                        self.class_names.append(parts[2].strip('"'))
            logger.info(f"类别映射表已加载: {len(self.class_names)} 个类别")
        else:
            logger.warning(f"类别映射表不存在: {self.class_map_path}")
            self.class_names = [f"Class_{i}" for i in range(521)]

    def predict(self, audio_data):
        """
        对音频数据进行推理

        参数:
            audio_data: numpy array, 形状 [15600], float32, 范围 [-1, 1]

        返回:
            scores: numpy array, 形状 [521], 每个类别的置信度
        """
        # 确保输入格式正确
        audio_data = audio_data.astype(np.float32)
        if len(audio_data) < AUDIO_SAMPLES:
            audio_data = np.pad(audio_data, (0, AUDIO_SAMPLES - len(audio_data)))
        elif len(audio_data) > AUDIO_SAMPLES:
            audio_data = audio_data[:AUDIO_SAMPLES]

        self.interpreter.set_tensor(self.input_details[0]['index'], audio_data)
        self.interpreter.invoke()

        # 获取输出分数
        scores = self.interpreter.get_tensor(self.output_details[0]['index'])
        return scores.flatten()

    def get_top_labels(self, scores, top_k=5):
        """获取置信度最高的 top_k 个标签"""
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
# 音频采集
# ============================================================================

class AudioCapture:
    """音频采集器"""

    def __init__(self, device_id=None, channels=32, sample_rate=SAMPLE_RATE):
        import sounddevice as sd
        self.sd = sd
        self.device_id = device_id
        self.channels = channels
        self.sample_rate = sample_rate

        if device_id is not None:
            sd.default.device = device_id
            logger.info(f"使用音频设备 ID: {device_id}")

    def record(self, duration=RECORD_DURATION):
        """
        录制一段音频

        返回:
            audio_data: numpy array, 形状 [samples], 归一化到 [-1, 1]
            rms: float, RMS 音量值
        """
        samples = int(duration * self.sample_rate)
        try:
            audio = self.sd.rec(samples, samplerate=self.sample_rate,
                               channels=self.channels, dtype='float32')
            self.sd.wait()

            # 取第一个通道
            if audio.shape[1] > 1:
                audio = audio[:, 0]
            else:
                audio = audio.flatten()

            # 归一化
            max_val = np.max(np.abs(audio))
            if max_val > 0:
                audio = audio / max_val

            # 计算 RMS
            rms = float(np.sqrt(np.mean(audio ** 2)))

            return audio, rms
        except Exception as e:
            logger.error(f"录音失败: {e}")
            return np.zeros(samples, dtype=np.float32), 0.0


# ============================================================================
# 服务器通信
# ============================================================================

class ServerClient:
    """与云端服务器通信的客户端"""

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
        """构建 tRPC API URL"""
        return f"{self.server_url}/api/trpc/{procedure}"

    def _trpc_mutation(self, procedure, data):
        """调用 tRPC mutation"""
        url = self._trpc_url(procedure)
        payload = {"json": data}
        try:
            resp = self.session.post(url, json=payload, timeout=self.timeout)
            if resp.status_code == 200:
                result = resp.json()
                return result.get('result', {}).get('data', {}).get('json', result)
            else:
                logger.error(f"API调用失败 [{procedure}]: {resp.status_code} {resp.text[:200]}")
                return None
        except requests.exceptions.Timeout:
            logger.error(f"API调用超时 [{procedure}]")
            return None
        except requests.exceptions.ConnectionError:
            logger.error(f"无法连接服务器 [{procedure}]")
            return None
        except Exception as e:
            logger.error(f"API调用异常 [{procedure}]: {e}")
            return None

    def _trpc_query(self, procedure, data):
        """调用 tRPC query"""
        url = self._trpc_url(procedure)
        # tRPC query 使用 GET 请求，参数编码在 input 查询参数中
        import urllib.parse
        input_json = json.dumps({"json": data})
        params = {"input": input_json}
        try:
            resp = self.session.get(url, params=params, timeout=self.timeout)
            if resp.status_code == 200:
                result = resp.json()
                return result.get('result', {}).get('data', {}).get('json', result)
            else:
                logger.error(f"API查询失败 [{procedure}]: {resp.status_code} {resp.text[:200]}")
                return None
        except Exception as e:
            logger.error(f"API查询异常 [{procedure}]: {e}")
            return None

    def heartbeat(self, status=None):
        """发送心跳"""
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
        """上传声音事件"""
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

        # 如果是危险事件，上传音频数据
        if is_danger and audio_data is not None:
            try:
                audio_base64 = self._encode_audio_wav(audio_data)
                data["audio_base64"] = audio_base64
            except Exception as e:
                logger.error(f"音频编码失败: {e}")

        return self._trpc_mutation("raspberryPi.uploadEvent", data)

    def get_config(self):
        """获取设备配置"""
        data = {
            "device_id": self.device_id,
            "api_token": self.api_token,
        }
        return self._trpc_query("raspberryPi.getConfig", data)

    def _encode_audio_wav(self, audio_data, sample_rate=SAMPLE_RATE):
        """将音频数据编码为 Base64 WAV 格式"""
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(sample_rate)
            # 转换为 16-bit PCM
            pcm_data = (audio_data * 32767).astype(np.int16)
            wf.writeframes(pcm_data.tobytes())
        return base64.b64encode(buf.getvalue()).decode('utf-8')


# ============================================================================
# 主监控循环
# ============================================================================

class MonitoringService:
    """声音监控服务"""

    def __init__(self, model, audio_capture, server_client, config=None):
        self.model = model
        self.audio = audio_capture
        self.server = server_client
        self.running = False
        self.config = config or {}

        # 从服务器配置更新阈值
        self.rms_threshold = self.config.get('rms_threshold', RMS_THRESHOLD)
        self.danger_threshold = self.config.get('danger_threshold', 0.75)

        # 统计
        self.total_detections = 0
        self.danger_detections = 0
        self.start_time = None

        # 心跳线程
        self.heartbeat_thread = None

    def start(self):
        """启动监控"""
        self.running = True
        self.start_time = time.time()

        # 启动心跳线程
        self.heartbeat_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self.heartbeat_thread.start()

        logger.info("=" * 60)
        logger.info("声音监控服务已启动")
        logger.info(f"  RMS 阈值: {self.rms_threshold}")
        logger.info(f"  危险阈值: {self.danger_threshold}")
        logger.info(f"  采样率: {SAMPLE_RATE} Hz")
        logger.info(f"  录音时长: {RECORD_DURATION} 秒")
        logger.info("=" * 60)

        try:
            self._monitoring_loop()
        except KeyboardInterrupt:
            logger.info("收到中断信号，正在停止...")
        finally:
            self.stop()

    def stop(self):
        """停止监控"""
        self.running = False
        elapsed = time.time() - self.start_time if self.start_time else 0
        logger.info("=" * 60)
        logger.info("声音监控服务已停止")
        logger.info(f"  运行时长: {elapsed:.0f} 秒")
        logger.info(f"  总检测次数: {self.total_detections}")
        logger.info(f"  危险事件次数: {self.danger_detections}")
        logger.info("=" * 60)

    def _monitoring_loop(self):
        """主监控循环"""
        while self.running:
            try:
                # 录音
                audio_data, rms = self.audio.record(RECORD_DURATION)

                # 音量条显示
                bar_len = int(rms * 200)
                bar = '#' * min(bar_len, 50)
                rms_str = f"RMS: {rms:.4f} |{bar:<50}|"

                # 检查是否超过阈值
                if rms < self.rms_threshold:
                    # 安静，跳过推理
                    sys.stdout.write(f"\r{rms_str} [安静]")
                    sys.stdout.flush()
                    continue

                # 进行 YAMNet 推理
                start_time = time.time()
                scores = self.model.predict(audio_data)
                processing_time = int((time.time() - start_time) * 1000)

                # 获取 Top-5 标签
                top_labels = self.model.get_top_labels(scores, top_k=5)
                primary = top_labels[0]

                # 判断是否为危险事件
                is_danger = primary['class_id'] in DANGER_CLASS_IDS
                self.total_detections += 1

                # 显示结果
                danger_flag = " [DANGER!]" if is_danger else ""
                print(f"\n{rms_str}")
                print(f"  识别结果: {primary['class_name']} "
                      f"(ID:{primary['class_id']}, "
                      f"置信度:{primary['confidence']:.2%}, "
                      f"耗时:{processing_time}ms)"
                      f"{danger_flag}")

                # 上传事件到服务器
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
                                alarm_info = f" -> 报警已创建 (ID: {result.get('alarm_id')})"
                            print(f"  >>> 危险事件已上传!{alarm_info}")
                        else:
                            print(f"  >>> 事件已上传 (置信度 > 50%)")
                    else:
                        print(f"  >>> 上传失败，将在下次重试")

            except Exception as e:
                logger.error(f"监控循环异常: {e}")
                time.sleep(1)

    def _heartbeat_loop(self):
        """心跳发送循环"""
        while self.running:
            try:
                # 获取系统状态
                status = self._get_system_status()
                result = self.server.heartbeat(status)
                if result:
                    # 检查是否有配置更新
                    config = result.get('config', {})
                    if config:
                        new_rms = config.get('rms_threshold')
                        new_danger = config.get('danger_threshold')
                        if new_rms and new_rms != self.rms_threshold:
                            self.rms_threshold = new_rms
                            logger.info(f"RMS 阈值已更新: {new_rms}")
                        if new_danger and new_danger != self.danger_threshold:
                            self.danger_threshold = new_danger
                            logger.info(f"危险阈值已更新: {new_danger}")
                else:
                    logger.warning("心跳发送失败")
            except Exception as e:
                logger.error(f"心跳异常: {e}")

            # 等待下一次心跳
            for _ in range(HEARTBEAT_INTERVAL):
                if not self.running:
                    break
                time.sleep(1)

    def _get_system_status(self):
        """获取树莓派系统状态"""
        status = {
            "model_version": "yamnet_v1",
        }

        # CPU 温度
        try:
            with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                temp = int(f.read().strip()) / 1000.0
                status['cpu_temp'] = temp
        except:
            pass

        # CPU 使用率
        try:
            with open('/proc/loadavg', 'r') as f:
                load = float(f.read().split()[0])
                status['cpu_usage'] = load
        except:
            pass

        # 运行时间
        try:
            with open('/proc/uptime', 'r') as f:
                uptime = float(f.read().split()[0])
                status['uptime'] = uptime
        except:
            pass

        return status


# ============================================================================
# 命令行入口
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='树莓派 YAMNet 声音监控客户端',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 基本使用
  python3 raspberry_pi_client.py \\
    --server-url https://eldersafe-fv6io3sc.manus.space \\
    --device-id rpi-001 \\
    --api-token YOUR_API_TOKEN

  # 指定音频设备和模型路径
  python3 raspberry_pi_client.py \\
    --server-url https://eldersafe-fv6io3sc.manus.space \\
    --device-id rpi-001 \\
    --api-token YOUR_API_TOKEN \\
    --audio-device 8 \\
    --channels 32 \\
    --model-path ./yamnet.tflite \\
    --class-map ./yamnet_class_map.csv

  # 调整阈值
  python3 raspberry_pi_client.py \\
    --server-url https://eldersafe-fv6io3sc.manus.space \\
    --device-id rpi-001 \\
    --api-token YOUR_API_TOKEN \\
    --rms-threshold 0.02 \\
    --danger-threshold 0.6
        """
    )

    # 必选参数
    parser.add_argument('--server-url', required=True,
                        help='云端服务器地址 (如 https://eldersafe-fv6io3sc.manus.space)')
    parser.add_argument('--device-id', required=True,
                        help='设备ID (如 rpi-001，需先在网页端注册)')
    parser.add_argument('--api-token', required=True,
                        help='设备API Token (注册设备时获取)')

    # 音频参数
    parser.add_argument('--audio-device', type=int, default=None,
                        help='音频设备ID (ReSpeaker通常为8)')
    parser.add_argument('--channels', type=int, default=32,
                        help='音频通道数 (ReSpeaker 4-Mic为32)')

    # 模型参数
    parser.add_argument('--model-path', default='yamnet.tflite',
                        help='YAMNet模型文件路径')
    parser.add_argument('--class-map', default='yamnet_class_map.csv',
                        help='类别映射表路径')

    # 阈值参数
    parser.add_argument('--rms-threshold', type=float, default=None,
                        help='RMS音量阈值 (默认从服务器获取或0.03)')
    parser.add_argument('--danger-threshold', type=float, default=None,
                        help='危险事件置信度阈值 (默认从服务器获取或0.75)')

    # 其他
    parser.add_argument('--test', action='store_true',
                        help='测试模式：只连接服务器不启动监控')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='详细日志输出')

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # 初始化服务器客户端
    logger.info("正在连接服务器...")
    client = ServerClient(args.server_url, args.device_id, args.api_token)

    # 测试连接
    logger.info("发送心跳测试...")
    heartbeat_result = client.heartbeat({"model_version": "yamnet_v1"})
    if heartbeat_result:
        logger.info(f"服务器连接成功! 服务器时间: {heartbeat_result.get('server_time')}")
    else:
        logger.error("无法连接服务器，请检查地址和Token")
        sys.exit(1)

    # 获取服务器配置
    config = {}
    server_config = client.get_config()
    if server_config:
        config = {
            'rms_threshold': server_config.get('rms_threshold', RMS_THRESHOLD),
            'danger_threshold': server_config.get('danger_threshold', 0.75),
        }
        logger.info(f"服务器配置已获取: {config}")

    # 命令行参数覆盖服务器配置
    if args.rms_threshold is not None:
        config['rms_threshold'] = args.rms_threshold
    if args.danger_threshold is not None:
        config['danger_threshold'] = args.danger_threshold

    if args.test:
        logger.info("测试模式：服务器连接正常，退出")
        return

    # 加载 YAMNet 模型
    logger.info("正在加载 YAMNet 模型...")
    model = YAMNetModel(args.model_path, args.class_map)

    # 初始化音频采集
    logger.info("正在初始化音频设备...")
    audio = AudioCapture(
        device_id=args.audio_device,
        channels=args.channels,
        sample_rate=SAMPLE_RATE,
    )

    # 启动监控服务
    service = MonitoringService(model, audio, client, config)

    # 注册信号处理
    def signal_handler(sig, frame):
        logger.info("收到停止信号...")
        service.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    service.start()


if __name__ == '__main__':
    main()
