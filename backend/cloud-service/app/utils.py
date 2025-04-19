import partitura

from pathlib import Path

from sqlalchemy.orm import Session
from app.models import User, Permission, UserRole, RolePermission
from app.auth import hash_password

def create_user(db: Session, email: str, username: str, password: str, permission_name: str):
    permission = db.query(Permission).filter(Permission.name == permission_name).first()
    if not permission:
        raise ValueError("Permission not found")

    new_user = User(
        email=email,
        username=username,
        hashed_password=hash_password(password),
        permission_id=permission.id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# 用户是否有对应权限
def has_permission(user_id: str, permission_name: str, db: Session) -> bool:
    user_roles = db.query(UserRole).filter(UserRole.user_id == user_id).all()
    for user_role in user_roles:
        role_permissions = db.query(RolePermission).filter(RolePermission.role_id == user_role.role_id).all()
        for role_permission in role_permissions:
            permission = db.query(Permission).filter(Permission.id == role_permission.permission_id).first()
            if permission and permission.name == permission_name:
                return True
    return False

def preprocess_score(score_xml: Path) -> tuple[str, str]:
    """
    Preprocess the score xml file to midi and audio file

    Parameters
    ----------
    score_xml : Path
        Path to the score xml file

    Returns
    -------
    tuple[str, str]
        Paths to the generated MIDI and audio files
    """
    score_obj = partitura.load_musicxml(score_xml)

    score_midi_path = f"./uploads/{score_xml.stem}.mid"
    partitura.save_score_midi(score_obj, score_midi_path)

    score_audio_path = f"./uploads/{score_xml.stem}.wav"
    partitura.save_wav_fluidsynth(score_obj, score_audio_path)

    return score_midi_path, score_audio_path
