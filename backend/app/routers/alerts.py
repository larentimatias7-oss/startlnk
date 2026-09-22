from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Dict, Any, Optional

from backend.app.core.database import get_db
from backend.app.models.terminal import AlertConfig, TelegramBot, TelegramChannel, AlertEvent
from backend.app.schemas.alert import (
    AlertConfigSchema,
    AlertConfigUpdate,
    TelegramBotSchema,
    TelegramBotCreate,
    TelegramBotUpdate,
    TelegramChannelSchema,
    TelegramChannelCreate,
    TelegramChannelUpdate,
    TestTelegramRequest,
    VerifyBotRequest,
    AlertEventSchema
)
from backend.app.services.alert_service import alert_service
from backend.app.services.telegram_service import telegram_service
from backend.app.services.scheduler import reschedule_sync_job
from backend.app.services.telegram_persistence import backup_telegram_config

router = APIRouter(prefix="/alerts", tags=["Alerts & Notifications"])

def _mask_token(tok: str) -> str:
    if not tok:
        return ""
    if len(tok) > 10:
        return f"{tok[:6]}...{tok[-4:]}"
    return "***"

def _enrich_channel_schema(
    ch: TelegramChannel,
    db: Session,
    bots_map: Optional[dict] = None
) -> TelegramChannelSchema:
    if bots_map is not None:
        bot = bots_map.get(ch.bot_id) if ch.bot_id else None
    else:
        bot = db.query(TelegramBot).filter(TelegramBot.id == ch.bot_id).first() if ch.bot_id else None
    return TelegramChannelSchema(
        id=ch.id,
        name=ch.name,
        chat_id=ch.chat_id,
        bot_id=ch.bot_id,
        bot_name=bot.name if bot else None,
        bot_username=bot.bot_username if bot else None,
        is_active=ch.is_active,
        created_at=ch.created_at
    )

# --- Alert Config Endpoints ---

@router.get("/config", response_model=AlertConfigSchema)
def get_alert_config(db: Session = Depends(get_db)):
    """Obtiene los parámetros actuales de configuración de alertas."""
    return alert_service.get_or_create_config(db)

@router.put("/config", response_model=AlertConfigSchema)
def update_alert_config(update_data: AlertConfigUpdate, db: Session = Depends(get_db)):
    """Actualiza umbrales de alerta, parámetros de sincronización y cooldown."""
    config = alert_service.get_or_create_config(db)

    data_dict = update_data.model_dump(exclude_unset=True)
    for field, value in data_dict.items():
        setattr(config, field, value)

    db.commit()
    db.refresh(config)

    # Reschedule scheduler if sync_interval_minutes was modified
    if "sync_interval_minutes" in data_dict and config.sync_interval_minutes:
        reschedule_sync_job(config.sync_interval_minutes)

    return config

# --- Telegram Bots CRUD Endpoints ---

@router.get("/bots", response_model=List[TelegramBotSchema])
def list_telegram_bots(db: Session = Depends(get_db)):
    """Lista todos los Bots de Telegram registrados."""
    bots = db.query(TelegramBot).order_by(TelegramBot.id.asc()).all()
    res = []
    for b in bots:
        ch_count = db.query(TelegramChannel).filter(TelegramChannel.bot_id == b.id).count()
        res.append(TelegramBotSchema(
            id=b.id,
            name=b.name,
            token_masked=_mask_token(b.token),
            bot_username=b.bot_username,
            bot_id=b.bot_id,
            is_default=b.is_default,
            is_active=b.is_active,
            channels_count=ch_count,
            created_at=b.created_at
        ))
    return res

@router.post("/bots", response_model=TelegramBotSchema, status_code=status.HTTP_201_CREATED)
async def create_telegram_bot(bot_data: TelegramBotCreate, db: Session = Depends(get_db)):
    """Conecta un nuevo bot validando su token con la API getMe de Telegram."""
    clean_token = bot_data.token.strip()
    v_res = await telegram_service.verify_bot_token(clean_token)
    if not v_res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Token no válido en Telegram: {v_res.get('error')}"
        )

    existing = db.query(TelegramBot).filter(TelegramBot.token == clean_token).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Este token ya está registrado con el bot '{existing.name}'"
        )

    has_bots = db.query(TelegramBot).count() > 0
    is_default = bot_data.is_default or not has_bots
    if is_default:
        db.query(TelegramBot).update({TelegramBot.is_default: False})

    bot = TelegramBot(
        name=bot_data.name.strip(),
        token=clean_token,
        bot_username=v_res.get("bot_username"),
        bot_id=str(v_res.get("bot_id")),
        is_default=is_default,
        is_active=bot_data.is_active
    )
    db.add(bot)

    # Also keep AlertConfig.telegram_bot_token in sync if this is default
    if is_default:
        cfg = alert_service.get_or_create_config(db)
        cfg.telegram_bot_token = clean_token

    db.commit()
    backup_telegram_config(db)
    db.refresh(bot)

    return TelegramBotSchema(
        id=bot.id,
        name=bot.name,
        token_masked=_mask_token(bot.token),
        bot_username=bot.bot_username,
        bot_id=bot.bot_id,
        is_default=bot.is_default,
        is_active=bot.is_active,
        channels_count=0,
        created_at=bot.created_at
    )

@router.put("/bots/{bot_id}", response_model=TelegramBotSchema)
async def update_telegram_bot(bot_id: int, update_data: TelegramBotUpdate, db: Session = Depends(get_db)):
    """Modifica el nombre, token, estado o marca como default un Bot de Telegram."""
    bot = db.query(TelegramBot).filter(TelegramBot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot no encontrado")

    if update_data.token and update_data.token.strip():
        clean_tok = update_data.token.strip()
        v_res = await telegram_service.verify_bot_token(clean_tok)
        if not v_res.get("success"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Token inválido: {v_res.get('error')}")
        bot.token = clean_tok
        bot.bot_username = v_res.get("bot_username")
        bot.bot_id = str(v_res.get("bot_id"))

    if update_data.name is not None and update_data.name.strip():
        bot.name = update_data.name.strip()
    if update_data.is_active is not None:
        bot.is_active = update_data.is_active

    if update_data.is_default is True:
        db.query(TelegramBot).filter(TelegramBot.id != bot_id).update({TelegramBot.is_default: False})
        bot.is_default = True
        # Keep config token in sync with default bot
        cfg = alert_service.get_or_create_config(db)
        cfg.telegram_bot_token = bot.token

    db.commit()
    backup_telegram_config(db)
    db.refresh(bot)
    ch_count = db.query(TelegramChannel).filter(TelegramChannel.bot_id == bot.id).count()

    return TelegramBotSchema(
        id=bot.id,
        name=bot.name,
        token_masked=_mask_token(bot.token),
        bot_username=bot.bot_username,
        bot_id=bot.bot_id,
        is_default=bot.is_default,
        is_active=bot.is_active,
        channels_count=ch_count,
        created_at=bot.created_at
    )

@router.delete("/bots/{bot_id}")
def delete_telegram_bot(bot_id: int, db: Session = Depends(get_db)):
    """Elimina un Bot de Telegram y desvincula sus canales asignados."""
    bot = db.query(TelegramBot).filter(TelegramBot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot no encontrado")

    # Unlink channels
    db.query(TelegramChannel).filter(TelegramChannel.bot_id == bot_id).update({TelegramChannel.bot_id: None})
    db.delete(bot)

    # If deleted bot was default, set another bot as default if any
    next_bot = db.query(TelegramBot).filter(TelegramBot.id != bot_id, TelegramBot.is_active == True).first()
    if next_bot:
        next_bot.is_default = True
        cfg = alert_service.get_or_create_config(db)
        cfg.telegram_bot_token = next_bot.token

    db.commit()
    backup_telegram_config(db)
    return {"success": True, "message": f"Bot '{bot.name}' eliminado"}

# --- Telegram Channels Endpoints ---

@router.get("/channels", response_model=List[TelegramChannelSchema])
def list_telegram_channels(db: Session = Depends(get_db)):
    """Lista todos los canales o grupos de Telegram registrados con su bot asignado."""
    channels = db.query(TelegramChannel).order_by(TelegramChannel.id.asc()).all()
    bots_map = {b.id: b for b in db.query(TelegramBot).all()}
    return [_enrich_channel_schema(ch, db, bots_map) for ch in channels]

@router.post("/channels", response_model=TelegramChannelSchema, status_code=status.HTTP_201_CREATED)
def create_telegram_channel(channel_data: TelegramChannelCreate, db: Session = Depends(get_db)):
    """Registra un nuevo canal de Telegram y lo asocia a un Bot."""
    existing = db.query(TelegramChannel).filter(TelegramChannel.chat_id == channel_data.chat_id.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un canal con el Chat ID '{channel_data.chat_id}'"
        )

    # Default to default bot if not specified
    assigned_bot_id = channel_data.bot_id
    if not assigned_bot_id:
        def_bot = db.query(TelegramBot).filter(TelegramBot.is_default == True, TelegramBot.is_active == True).first()
        if not def_bot:
            def_bot = db.query(TelegramBot).filter(TelegramBot.is_active == True).first()
        if def_bot:
            assigned_bot_id = def_bot.id

    channel = TelegramChannel(
        name=channel_data.name.strip(),
        chat_id=channel_data.chat_id.strip(),
        bot_id=assigned_bot_id,
        is_active=channel_data.is_active
    )
    db.add(channel)
    db.commit()
    backup_telegram_config(db)
    db.refresh(channel)
    return _enrich_channel_schema(channel, db)

@router.put("/channels/{channel_id}", response_model=TelegramChannelSchema)
def update_telegram_channel(channel_id: int, update_data: TelegramChannelUpdate, db: Session = Depends(get_db)):
    """Modifica o conmuta el estado o el bot asignado de un canal de Telegram."""
    channel = db.query(TelegramChannel).filter(TelegramChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canal no encontrado")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(channel, field, value)

    db.commit()
    backup_telegram_config(db)
    db.refresh(channel)
    return _enrich_channel_schema(channel, db)

@router.delete("/channels/{channel_id}")
def delete_telegram_channel(channel_id: int, db: Session = Depends(get_db)):
    """Elimina un canal de Telegram."""
    channel = db.query(TelegramChannel).filter(TelegramChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canal no encontrado")

    db.delete(channel)
    db.commit()
    backup_telegram_config(db)
    return {"success": True, "message": f"Canal '{channel.name}' eliminado"}

@router.post("/channels/{channel_id}/test-real-alerts")
async def test_channel_with_real_alerts(channel_id: int, db: Session = Depends(get_db)):
    """
    Evalúa la flota en vivo y envía todas las alertas reales y vigentes al momento
    directamente al canal especificado, omitiendo la ventana de cooldown.
    """
    res = await alert_service.test_channel_with_real_alerts(db, channel_id)
    if not res.get("success"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res.get("error"))
    return res

# --- Verification & Testing Endpoints ---

@router.post("/verify-bot")
async def verify_telegram_bot(req: VerifyBotRequest, db: Session = Depends(get_db)):
    """
    Verifica si el Telegram Bot Token es válido consultando directamente la API getMe de Telegram.
    """
    token = req.bot_token
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
    Envía un mensaje de prueba a un canal específico utilizando el bot asignado (o especificado).
    """
    config = alert_service.get_or_create_config(db)

    # Determine default bot
    default_bot = db.query(TelegramBot).filter(TelegramBot.is_default == True, TelegramBot.is_active == True).first()
    if not default_bot:
        default_bot = db.query(TelegramBot).filter(TelegramBot.is_active == True).first()

    default_token = default_bot.token if default_bot else config.telegram_bot_token

    # 1. Si se especificó un chat_id particular
    if req.chat_id and req.chat_id.strip():
        target_chat = req.chat_id.strip()
        channel = db.query(TelegramChannel).filter(TelegramChannel.chat_id == target_chat).first()

        # Resolve which bot token to use
        bot_token = req.custom_bot_token
        if not bot_token:
            if req.bot_id:
                explicit_bot = db.query(TelegramBot).filter(TelegramBot.id == req.bot_id).first()
                if explicit_bot:
                    bot_token = explicit_bot.token
            elif channel and channel.bot_id:
                ch_bot = db.query(TelegramBot).filter(TelegramBot.id == channel.bot_id).first()
                if ch_bot and ch_bot.is_active:
                    bot_token = ch_bot.token

        if not bot_token:
            bot_token = default_token

        if not bot_token or not bot_token.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No hay ningún Bot de Telegram configurado o activo para emitir el mensaje"
            )

        channel_name = channel.name if channel else "Canal Individual"
        test_msg = req.message or telegram_service.format_test_message(channel_name)
        result = await telegram_service.send_message(bot_token, target_chat, test_msg)
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error de Telegram: {result.get('error')}"
            )
        return {"success": True, "detail": f"Mensaje de prueba entregado exitosamente a '{channel_name}'"}

    # 2. Probar con todos los canales activos
    channels = db.query(TelegramChannel).filter(TelegramChannel.is_active == True).all()
    if not channels:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay canales activos registrados para probar. Agrega un canal primero."
        )

    results = []
    bots_by_id = {b.id: b for b in db.query(TelegramBot).filter(TelegramBot.is_active == True).all()}

    for ch in channels:
        assigned_bot = bots_by_id.get(ch.bot_id) if ch.bot_id else default_bot
        token = assigned_bot.token if assigned_bot else default_token

        if not token:
            results.append({
                "channel_id": ch.id,
                "name": ch.name,
                "chat_id": ch.chat_id,
                "success": False,
                "error": "Sin bot asignado"
            })
            continue

        test_msg = req.message or telegram_service.format_test_message(ch.name)
        res = await telegram_service.send_message(token, ch.chat_id, test_msg)
        results.append({
            "channel_id": ch.id,
            "name": ch.name,
            "chat_id": ch.chat_id,
            "bot": assigned_bot.name if assigned_bot else "Default",
            "success": res.get("success", False),
            "error": res.get("error")
        })

    any_success = any(r["success"] for r in results)
    return {
        "success": any_success,
        "detail": f"Prueba enviada a {len(channels)} canal(es)",
        "results": results
    }

# --- History & Evaluation Endpoints ---

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
