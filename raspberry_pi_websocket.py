#!/usr/bin/env python3
"""
树莓派WebSocket客户端 - 用于实时推送YAMNet推理结果到云端

功能：
- 连接到云端WebSocket服务器
- 实时发送YAMNet推理结果
- 自动重连和心跳检测
- 本地缓存和离线支持
"""

import websocket
import json
import threading
import time
import logging
import sys
import os
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('websocket_client.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class YAMNetWebSocketClient:
    """
    YAMNet WebSocket客户端
    
    负责与云端WebSocket服务器通信，实时推送YAMNet推理结果
    """

    def __init__(
        self,
        server_url: str,
        device_id: str,
        elderly_id: str,
        device_token: str,
        cache_dir: str = './cache'
    ):
        """
        初始化WebSocket客户端
        
        Args:
            server_url: WebSocket服务器地址 (wss://...)
            device_id: 设备ID
            elderly_id: 老人ID
            device_token: 设备认证令牌
            cache_dir: 本地缓存目录
        """
        self.server_url = server_url
        self.device_id = device_id
        self.elderly_id = elderly_id
        self.device_token = device_token
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)

        self.ws: Optional[websocket.WebSocketApp] = None
        self.connected = False
        self.reconnect_count = 0
        self.max_reconnect_attempts = 10
        self.reconnect_delay = 5
        
        self.message_queue: List[Dict[str, Any]] = []
        self.stats = {
            'total_messages': 0,
            'successful_sends': 0,
            'failed_sends': 0,
            'last_send_time': None,
            'last_error': None
        }

    def connect(self) -> bool:
        """
        连接到WebSocket服务器
        
        Returns:
            bool: 连接是否成功
        """
        try:
            logger.info(f"正在连接到 {self.server_url}")
            
            # 禁用SSL证书验证（仅用于开发环境）
            # 生产环境应该启用证书验证
            websocket.enableTrace(False)
            
            self.ws = websocket.WebSocketApp(
                self.server_url,
                on_open=self.on_open,
                on_message=self.on_message,
                on_error=self.on_error,
                on_close=self.on_close,
                header={
                    'User-Agent': f'YAMNet-Client/{self.device_id}'
                }
            )

            # 在后台线程中运行WebSocket
            wst = threading.Thread(target=self.ws.run_forever, daemon=True)
            wst.start()
            
            # 等待连接建立
            for _ in range(10):
                if self.connected:
                    return True
                time.sleep(0.5)
            
            return False

        except Exception as e:
            logger.error(f"连接失败: {e}")
            self.stats['last_error'] = str(e)
            return False

    def on_open(self, ws: websocket.WebSocketApp) -> None:
        """
        WebSocket连接打开时调用
        
        Args:
            ws: WebSocket应用实例
        """
        logger.info("✓ WebSocket连接已打开")
        self.connected = True
        self.reconnect_count = 0

        # 发送注册消息
        register_msg = {
            'type': 'register',
            'deviceId': self.device_id,
            'elderlyId': self.elderly_id,
            'deviceToken': self.device_token
        }
        
        try:
            ws.send(json.dumps(register_msg))
            logger.info(f"✓ 注册消息已发送: {self.device_id}")
        except Exception as e:
            logger.error(f"✗ 注册失败: {e}")

        # 启动心跳线程
        threading.Thread(target=self.heartbeat_loop, daemon=True).start()
        
        # 启动消息队列处理线程
        threading.Thread(target=self.process_queue, daemon=True).start()

    def on_message(self, ws: websocket.WebSocketApp, message: str) -> None:
        """
        接收到消息时调用
        
        Args:
            ws: WebSocket应用实例
            message: 接收到的消息
        """
        try:
            data = json.loads(message)
            msg_type = data.get('type')

            if msg_type == 'registered':
                logger.info(f"✓ 设备已注册: {data.get('clientId')}")
            elif msg_type == 'heartbeat':
                # 响应心跳
                heartbeat_ack = {
                    'type': 'heartbeat_ack',
                    'timestamp': int(time.time() * 1000)
                }
                ws.send(json.dumps(heartbeat_ack))
            elif msg_type == 'error':
                logger.error(f"✗ 服务器错误: {data.get('message')}")
                self.stats['last_error'] = data.get('message')

        except Exception as e:
            logger.error(f"✗ 消息处理错误: {e}")

    def on_error(self, ws: websocket.WebSocketApp, error: Exception) -> None:
        """
        发生错误时调用
        
        Args:
            ws: WebSocket应用实例
            error: 错误对象
        """
        logger.error(f"✗ WebSocket错误: {error}")
        self.stats['last_error'] = str(error)

    def on_close(self, ws: websocket.WebSocketApp, close_status_code: int, close_msg: str) -> None:
        """
        连接关闭时调用
        
        Args:
            ws: WebSocket应用实例
            close_status_code: 关闭代码
            close_msg: 关闭消息
        """
        logger.warning(f"⚠ WebSocket连接已关闭: {close_msg}")
        self.connected = False
        self.reconnect()

    def send_inference(self, inference_results: List[Dict[str, Any]]) -> bool:
        """
        发送YAMNet推理结果
        
        Args:
            inference_results: 推理结果列表
            
        Returns:
            bool: 是否成功发送
        """
        if not self.connected or not self.ws:
            logger.warning("⚠ 未连接，将结果添加到队列")
            self.message_queue.append({
                'type': 'inference',
                'inference': inference_results,
                'timestamp': int(time.time() * 1000)
            })
            return False

        try:
            message = {
                'type': 'inference',
                'inference': inference_results,
                'timestamp': int(time.time() * 1000)
            }
            
            self.ws.send(json.dumps(message))
            
            # 更新统计
            self.stats['total_messages'] += 1
            self.stats['successful_sends'] += 1
            self.stats['last_send_time'] = datetime.now().isoformat()
            
            # 获取主要事件
            main_event = inference_results[0]['class_name'] if inference_results else 'unknown'
            confidence = (inference_results[0]['confidence'] * 100) if inference_results else 0
            
            logger.info(f"✓ 推理结果已发送: {main_event} ({confidence:.1f}%)")
            return True

        except Exception as e:
            logger.error(f"✗ 发送失败: {e}")
            self.stats['failed_sends'] += 1
            self.stats['last_error'] = str(e)
            
            # 添加到队列以便稍后重试
            self.message_queue.append({
                'type': 'inference',
                'inference': inference_results,
                'timestamp': int(time.time() * 1000)
            })
            
            return False

    def heartbeat_loop(self) -> None:
        """
        定期发送心跳
        """
        while self.connected:
            try:
                if self.ws and self.connected:
                    heartbeat_msg = {
                        'type': 'heartbeat',
                        'timestamp': int(time.time() * 1000)
                    }
                    self.ws.send(json.dumps(heartbeat_msg))
                
                time.sleep(30)  # 每30秒发送一次心跳

            except Exception as e:
                logger.error(f"✗ 心跳发送失败: {e}")
                break

    def process_queue(self) -> None:
        """
        处理消息队列，重试失败的消息
        """
        while True:
            try:
                if self.connected and len(self.message_queue) > 0:
                    message = self.message_queue.pop(0)
                    
                    if self.ws:
                        self.ws.send(json.dumps(message))
                        self.stats['successful_sends'] += 1
                        logger.info(f"✓ 队列消息已发送 (队列剩余: {len(self.message_queue)})")
                
                time.sleep(1)

            except Exception as e:
                logger.error(f"✗ 队列处理错误: {e}")
                time.sleep(5)

    def reconnect(self) -> None:
        """
        重新连接
        """
        if self.reconnect_count < self.max_reconnect_attempts:
            self.reconnect_count += 1
            logger.info(f"⚠ 将在{self.reconnect_delay}秒后重新连接 (尝试 {self.reconnect_count}/{self.max_reconnect_attempts})")
            time.sleep(self.reconnect_delay)
            self.connect()
        else:
            logger.error("✗ 超过最大重连次数，放弃重连")

    def close(self) -> None:
        """
        关闭连接
        """
        if self.ws:
            self.ws.close()
            self.connected = False
            logger.info("✓ WebSocket连接已关闭")

    def get_stats(self) -> Dict[str, Any]:
        """
        获取统计信息
        
        Returns:
            dict: 统计信息
        """
        return {
            **self.stats,
            'connected': self.connected,
            'queue_size': len(self.message_queue),
            'device_id': self.device_id,
            'elderly_id': self.elderly_id
        }

    def print_stats(self) -> None:
        """
        打印统计信息
        """
        stats = self.get_stats()
        print("\n" + "="*60)
        print("WebSocket客户端统计信息")
        print("="*60)
        print(f"连接状态:        {'✓ 已连接' if stats['connected'] else '✗ 未连接'}")
        print(f"设备ID:          {stats['device_id']}")
        print(f"老人ID:          {stats['elderly_id']}")
        print(f"总消息数:        {stats['total_messages']}")
        print(f"成功发送:        {stats['successful_sends']}")
        print(f"失败发送:        {stats['failed_sends']}")
        print(f"队列大小:        {stats['queue_size']}")
        print(f"最后发送时间:    {stats['last_send_time']}")
        if stats['last_error']:
            print(f"最后错误:        {stats['last_error']}")
        print("="*60 + "\n")


def main():
    """
    主函数 - 演示如何使用WebSocket客户端
    """
    # 配置
    SERVER_URL = os.getenv('WS_SERVER_URL', 'wss://eldersafe-fv6io3sc.manus.space/ws')
    DEVICE_ID = os.getenv('DEVICE_ID', 'raspberry_pi_001')
    ELDERLY_ID = os.getenv('ELDERLY_ID', 'elder_001')
    DEVICE_TOKEN = os.getenv('DEVICE_TOKEN', 'your_device_token')

    logger.info("="*60)
    logger.info("YAMNet WebSocket客户端启动")
    logger.info("="*60)
    logger.info(f"服务器: {SERVER_URL}")
    logger.info(f"设备ID: {DEVICE_ID}")
    logger.info(f"老人ID: {ELDERLY_ID}")
    logger.info("="*60)

    # 创建客户端
    client = YAMNetWebSocketClient(SERVER_URL, DEVICE_ID, ELDERLY_ID, DEVICE_TOKEN)
    
    # 连接
    if not client.connect():
        logger.error("✗ 连接失败")
        return

    # 模拟发送推理结果
    try:
        counter = 0
        while True:
            counter += 1
            
            # 模拟YAMNet推理结果
            inference_results = [
                {
                    'class_id': 123 + (counter % 4),
                    'class_name': ['尖叫', '咳嗽', '摔倒', '呻吟'][counter % 4],
                    'confidence': 0.80 + (counter % 20) / 100,
                    'event_type': 'danger'
                }
            ]
            
            # 发送推理结果
            client.send_inference(inference_results)
            
            # 每10次发送一次打印统计信息
            if counter % 10 == 0:
                client.print_stats()
            
            time.sleep(10)  # 每10秒发送一次

    except KeyboardInterrupt:
        logger.info("\n程序已停止")
        client.print_stats()
        client.close()


if __name__ == '__main__':
    main()
