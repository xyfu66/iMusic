from enum import Enum

class GetFileType(Enum):
    SCORE_FILE = "score"
    AUDIO_FILE = "audio"
    MIDI_FILE = "midi"


class EvaluationMetric(Enum):
    PITCH_ACCURACY = "音高准确度"
    RHYTHM_ACCURACY = "节奏准确度"
    TIMING_STABILITY = "节奏稳定性"
    OVERALL_FLUENCY = "演奏流畅度"
    EXPRESSION = "表现力"
