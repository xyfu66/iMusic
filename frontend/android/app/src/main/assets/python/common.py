from enum import Enum

# 枚举类型
class InputType(Enum):
    AUDIO = "audio"
    MIDI = "midi"


class GetFileType(Enum):
    SCORE_FILE = "score"
    AUDIO_FILE = "audio"
    MIDI_FILE = "midi"
