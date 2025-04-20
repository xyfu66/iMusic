import logging
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
from enum import Enum
import partitura
from matchmaker import Matchmaker
from .common import GetFileType, EvaluationMetric
from .utils import find_file_by_id


class PerformanceEvaluator:
    def __init__(self):
        self.score_weights = {
            EvaluationMetric.PITCH_ACCURACY: 0.3,
            EvaluationMetric.RHYTHM_ACCURACY: 0.3,
            EvaluationMetric.TIMING_STABILITY: 0.2,
            EvaluationMetric.OVERALL_FLUENCY: 0.1,
            EvaluationMetric.EXPRESSION: 0.1
        }

    async def evaluate_performance(self, file_id: str, recording_path: Path) -> Dict[str, Any]:
        try:
            # 1. 获取乐谱文件
            score_file = await find_file_by_id(file_id, GetFileType.SCORE_FILE)
            if not score_file:
                raise ValueError("无法获取乐谱文件")

            # 2. 使用Matchmaker进行音频分析
            mm = Matchmaker(
                score_file=str(score_file),
                performance_file=str(recording_path),
                input_type=GetFileType.AUDIO_FILE.value
            )

            # 3. 获取匹配结果
            alignment_results = []
            for result in mm.run():
                alignment_results.append(result)

            # 4. 分析演奏表现
            evaluation_results = {
                "timestamp": datetime.now().isoformat(),
                "metrics": self._analyze_performance(alignment_results, mm),
                "details": self._generate_detailed_feedback(alignment_results, mm)
            }

            # 5. 计算总分
            total_score = self._calculate_total_score(evaluation_results["metrics"])
            evaluation_results["total_score"] = total_score

            return {
                "success": True,
                "data": evaluation_results
            }

        except Exception as e:
            logging.error(f"评测过程发生错误: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def _analyze_performance(self, alignment_results: list, mm: Matchmaker) -> Dict[str, float]:
        """分析演奏表现的各个指标"""
        metrics = {}
        
        # 音高准确度分析
        pitch_errors = self._analyze_pitch_accuracy(mm)
        metrics[EvaluationMetric.PITCH_ACCURACY.value] = self._normalize_score(100 - pitch_errors, 0, 100)

        # 节奏准确度分析
        rhythm_errors = self._analyze_rhythm_accuracy(alignment_results)
        metrics[EvaluationMetric.RHYTHM_ACCURACY.value] = self._normalize_score(100 - rhythm_errors, 0, 100)

        # 节奏稳定性分析
        timing_stability = self._analyze_timing_stability(alignment_results)
        metrics[EvaluationMetric.TIMING_STABILITY.value] = self._normalize_score(timing_stability, 0, 100)

        # 演奏流畅度分析
        fluency = self._analyze_fluency(alignment_results)
        metrics[EvaluationMetric.OVERALL_FLUENCY.value] = self._normalize_score(fluency, 0, 100)

        # 表现力分析
        expression = self._analyze_expression(mm)
        metrics[EvaluationMetric.EXPRESSION.value] = self._normalize_score(expression, 0, 100)

        return metrics

    def _analyze_pitch_accuracy(self, mm: Matchmaker) -> float:
        """分析音高准确度"""
        # TODO: 实现音高准确度分析
        # 1. 提取演奏的音高序列
        # 2. 与标准音高进行比对
        # 3. 计算偏差率
        return 15.0  # 示例返回值

    def _analyze_rhythm_accuracy(self, alignment_results: list) -> float:
        """分析节奏准确度"""
        # TODO: 实现节奏准确度分析
        # 1. 分析音符时值
        # 2. 计算与标准节奏的偏差
        return 20.0  # 示例返回值

    def _analyze_timing_stability(self, alignment_results: list) -> float:
        """分析节奏稳定性"""
        # TODO: 实现节奏稳定性分析
        # 1. 计算相邻音符间隔的变化率
        # 2. 评估速度的稳定性
        return 85.0  # 示例返回值

    def _analyze_fluency(self, alignment_results: list) -> float:
        """分析演奏流畅度"""
        # TODO: 实现流畅度分析
        # 1. 检测中断和停顿
        # 2. 评估演奏的连贯性
        return 80.0  # 示例返回值

    def _analyze_expression(self, mm: Matchmaker) -> float:
        """分析表现力"""
        # TODO: 实现表现力分析
        # 1. 分析力度变化
        # 2. 分析速度变化
        # 3. 评估演奏的表现力
        return 75.0  # 示例返回值

    def _normalize_score(self, value: float, min_val: float, max_val: float) -> float:
        """将分数标准化到0-100范围"""
        return max(0, min(100, ((value - min_val) / (max_val - min_val)) * 100))

    def _calculate_total_score(self, metrics: Dict[str, float]) -> float:
        """计算总分"""
        total_score = 0
        for metric, score in metrics.items():
            weight = self.score_weights[EvaluationMetric(metric)]
            total_score += score * weight
        return round(total_score, 2)

    def _generate_detailed_feedback(self, alignment_results: list, mm: Matchmaker) -> list:
        """生成详细的反馈信息"""
        return [
            {
                "measure": 1,  # 小节号
                "notes": [
                    {
                        "pitch": "C4",
                        "timing_error": -0.1,  # 负值表示提前，正值表示延后
                        "pitch_error": 0.2,    # 音高偏差（半音）
                        "velocity_error": 5,    # 力度偏差
                        "suggestions": ["音高稍微偏低", "节奏略快"]
                    }
                ]
            }
        ]