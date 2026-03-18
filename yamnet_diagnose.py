#!/usr/bin/env python3
"""
YAMNet诊断工具 - 检测模型配置
"""

import numpy as np
import tflite_runtime.interpreter as tflite
import sys

print("\n" + "="*70)
print("🔍 YAMNet 模型诊断工具")
print("="*70 + "\n")

try:
    # 加载模型
    print("[1/5] 正在加载YAMNet模型...")
    interpreter = tflite.Interpreter(model_path="yamnet.tflite")
    interpreter.allocate_tensors()
    print("✓ 模型加载成功\n")
    
    # 获取输入详情
    print("[2/5] 获取输入详情...")
    in_det = interpreter.get_input_details()
    print(f"输入详情类型: {type(in_det)}")
    print(f"输入详情内容: {in_det}\n")
    
    # 处理输入详情
    if isinstance(in_det, list):
        in_details = in_det[0]
    else:
        in_details = in_det
    
    print("[3/5] 分析输入配置...")
    print(f"输入索引: {in_details.get('index', 'N/A')}")
    print(f"输入名称: {in_details.get('name', 'N/A')}")
    print(f"输入形状: {in_details.get('shape', 'N/A')}")
    print(f"输入类型: {in_details.get('dtype', 'N/A')}")
    print(f"输入量化参数: {in_details.get('quantization', 'N/A')}\n")
    
    IN_SHAPE = in_details.get('shape')
    IN_IDX = in_details.get('index')
    
    # 获取输出详情
    print("[4/5] 获取输出详情...")
    out_det = interpreter.get_output_details()
    print(f"输出详情类型: {type(out_det)}")
    print(f"输出详情内容: {out_det}\n")
    
    if isinstance(out_det, list):
        out_details = out_det[0]
    else:
        out_details = out_det
    
    print("输出索引: {out_details.get('index', 'N/A')}")
    print(f"输出名称: {out_details.get('name', 'N/A')}")
    print(f"输出形状: {out_details.get('shape', 'N/A')}")
    print(f"输出类型: {out_details.get('dtype', 'N/A')}\n")
    
    OUT_IDX = out_details.get('index')
    OUT_SHAPE = out_details.get('shape')
    
    # 测试推理
    print("[5/5] 测试推理...")
    print(f"预期输入形状: {IN_SHAPE}")
    print(f"预期输出形状: {OUT_SHAPE}\n")
    
    # 尝试不同的输入大小
    test_sizes = [15600, 16000, 1, 521]
    
    for size in test_sizes:
        try:
            print(f"尝试输入大小: {size}...", end=" ")
            
            # 创建测试数据
            test_data = np.random.randn(size).astype(np.float32)
            
            # 尝试reshape
            try:
                reshaped = np.reshape(test_data, IN_SHAPE).astype(np.float32)
                print(f"✓ 可以reshape为 {IN_SHAPE}")
                
                # 尝试推理
                interpreter.set_tensor(IN_IDX, reshaped)
                interpreter.invoke()
                output = interpreter.get_tensor(OUT_IDX)
                print(f"  推理成功！输出形状: {output.shape}")
                
                print(f"\n✅ 正确的配置:")
                print(f"   输入大小: {size}")
                print(f"   输入形状: {IN_SHAPE}")
                print(f"   输出形状: {OUT_SHAPE}")
                break
                
            except ValueError as e:
                print(f"✗ reshape失败: {e}")
        
        except Exception as e:
            print(f"✗ 错误: {e}")
    
    print("\n" + "="*70)
    print("诊断完成！")
    print("="*70 + "\n")
    
except Exception as e:
    print(f"\n✗ 诊断失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
