from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Dict, Any

from backend.app.core.database import get_db
from backend.app.models.terminal import AlertConfig, TelegramChannel, AlertEvent
from backend.app.schemas.alert import (
    AlertConfigSchema,
    AlertConfigUpdate,
    TelegramChannelSchema,
    TelegramChannelCreate,
    TelegramChannelUpdate,
    TestTelegramRequest,
    VerifyBotRequest,
    AlertEventSchema
)
from backend.app.services.alert_service import alert_service
from backend.app.services.telegram_service import telegram_service

router = APIRouter(prefix="/alerts", tags=["Alerts & Notifications"])

@router.get("/config", response_model=AlertConfigSchema)
def get_alert_config(db: Session = Depends(get_db)):
    """Obtiene los parámetros actuales de configuración de alertas."""
    return alert_service.get_or_create_config(db)

@router.put("/config", response_model=AlertConfigSchema)
def update_alert_config(update_data: AlertConfigUpdate, db: Session = Depends(get_db)):
    """Actualiza umbrales de alerta, bot token y parámetros del algoritmo."""
    config = alert_service.get_or_create_config(db)

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(config, field, value)

    db.commit()
    db.refresh(config)
    return config

@router.get("/channels", response_model=List[TelegramChannelSchema])
def list_telegram_channels(db: Session = Depends(get_db)):
    """Lista todos los canales o grupos de Telegram registrados."""
    return db.query(TelegramChannel).order_by(TelegramChannel.id.asc()).all()

@router.post("/channels", response_model=TelegramChannelSchema, status_code=status.HTTP_201_CREATED)
def create_telegram_channel(channel_data: TelegramChannelCreate, db: Session = Depends(get_db)):
    """Registra un nuevo canal de Telegram destinatario de alertas."""
    existing = db.query(TelegramChannel).filter(TelegramChannel.chat_id == channel_data.chat_id.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un canal con el Chat ID '{channel_data.chat_id}'"
        )

    channel = TelegramChannel(
        name=channel_data.name.strip(),
        chat_id=channel_data.chat_id.strip(),
        is_active=channel_data.is_active
    )
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return channel

@router.put("/channels/{channel_id}", response_model=TelegramChannelSchema)
def update_telegram_channel(channel_id: int, update_data: TelegramChannelUpdate, db: Session = Depends(get_db)):
    """Modifica o conmuta el estado de un canal de Telegram."""
    channel = db.query(TelegramChannel).filter(TelegramChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canal no encontrado")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(channel, field, value)

    db.commit()
    db.refresh(channel)
    return channel

@router.delete("/channels/{channel_id}")
def delete_telegram_channel(channel_id: int, db: Session = Depends(get_db)):
    """Elimina un canal de Telegram."""
    channel = db.query(TelegramChannel).filter(TelegramChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canal no encontrado")

    db.delete(channel)
    db.commit()
    return {"success": True, "message": f"Canal '{channel.name}' eliminado"}

@router.post("/verify-bot")
async def verify_telegram_bot(req: VerifyBotRequest, db: Session = Depends(get_db)):
    """
    Verifica si el Telegram Bot Token es válido consultando directamente la API getMe de Telegram.
    Retorna el nombre del bot y el username (@bot).
    """
    config = alert_service.get_or_create_config(db)
    token = req.bot_token or config.telegram_bot_token

    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Por favor ingresa un Telegram Bot Token para verificar"
        )

    res = await telegram_service.verify_bot_token(token.strip())
    if not res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al verificar con Telegram: {res.get('error')}"
        )

    return res

@router.post("/test-telegram")
async def test_telegram_connection(req: TestTelegramRequest, db: Session = Depends(get_db)):
    """
    Envía un mensaje de prueba a un canal específico o a todos los canales activos
    para validar conectividad y permisos del Bot de Telegram.
    """
    config = alert_service.get_or_create_config(db)
    bot_token = req.custom_bot_token or config.telegram_bot_token

    if not bot_token or not bot_token.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Se requiere un Telegram Bot Token para enviar la prueba"
        )

    # Si se especificó un chat_id particular
    if req.chat_id and req.chat_id.strip():
        test_msg = req.message or telegram_service.format_test_message("Canal Individual")
        result = await telegram_service.send_message(bot_token, req.chat_id.strip(), test_msg)
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error de Telegram: {result.get('error')}"
            )
        return {"success": True, "detail": "Mensaje de prueba entregado exitosamente"}

    # Sino, probar con todos los canales activos
    channels = db.query(TelegramChannel).filter(TelegramChannel.is_active == True).all()
    if not channels:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay canales activos registrados para probar. Agrega un canal primero."
        )

    results = []
    for ch in channels:
        test_msg = req.message or telegram_service.format_test_message(ch.name)
        res = await telegram_service.send_message(bot_token, ch.chat_id, test_msg)
        results.append({
            "channel_id": ch.id,
            "name": ch.name,
            "chat_id": ch.chat_id,
            "success": res.get("success", False),
            "error": res.get("error")
        })

    any_success = any(r["success"] for r in results)
    return {
        "success": any_success,
        "detail": f"Prueba enviada a {len(channels)} canal(es)",
        "results": results
    }

@router.get("/history", response_model=List[AlertEventSchema])
def get_alert_history(limit: int = 50, db: Session = Depends(get_db)):
    """Obtiene la bitácora de las últimas alertas enviadas o disparadas."""
    return (
        db.query(AlertEvent)
        .order_by(desc(AlertEvent.timestamp))
        .limit(limit)
        .all()
    )

@router.post("/evaluate")
async def evaluate_alerts(db: Session = Depends(get_db)):
    """Dispara manualmente la evaluación de alertas sobre toda la flota."""
    return await alert_service.evaluate_and_dispatch(db)
