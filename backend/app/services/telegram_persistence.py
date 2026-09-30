import json
import logging
import os
from pathlib import Path
from sqlalchemy.orm import Session
from backend.app.models.terminal import AlertConfig, TelegramBot, TelegramChannel
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# Search paths for persistent telegram configuration
CONFIG_PATHS = [
    Path("/app/data/telegram_config.json"),
    Path(__file__).resolve().parent.parent / "data" / "telegram_config.json",
    Path(__file__).resolve().parent.parent / "data" / "telegram_seed.json",
    Path("telegram_config.json"),
]

def get_writable_config_path() -> Path:
    """Returns the best path to store persistent telegram configuration."""
    if Path("/app/data").exists() and os.access("/app/data", os.W_OK):
        return Path("/app/data/telegram_config.json")
    local_data = Path(__file__).resolve().parent.parent / "data"
    local_data.mkdir(parents=True, exist_ok=True)
    return local_data / "telegram_config.json"

def backup_telegram_config(db: Session):
    """Backs up current Telegram bots and channels to a persistent JSON file."""
    try:
        bots = db.query(TelegramBot).all()
        channels = db.query(TelegramChannel).all()
        cfg = db.query(AlertConfig).first()

        data = {
            "bot_token_legacy": cfg.telegram_bot_token if cfg else None,
            "bots": [
                {
                    "id": b.id,
                    "name": b.name,
                    "token": b.token,
                    "bot_username": b.bot_username,
                    "bot_id": b.bot_id,
                    "is_default": b.is_default,
                    "is_active": b.is_active,
                }
                for b in bots
            ],
            "channels": [
                {
                    "name": c.name,
                    "chat_id": c.chat_id,
                    "bot_id": c.bot_id,
                    "is_active": c.is_active,
                }
                for c in channels
            ],
        }

        target_path = get_writable_config_path()
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        logger.info(f"Telegram configuration successfully backed up to {target_path}")
    except Exception as e:
        logger.warning(f"Could not backup telegram configuration: {e}")

def seed_telegram_defaults(db: Session):
    """
    Seeds default Telegram bots and channels if the database is fresh or empty.
    Restores configuration from JSON seed/backup files or application defaults.
    """
    try:
        # Ensure AlertConfig exists
        cfg = db.query(AlertConfig).first()
        if not cfg:
            cfg = AlertConfig(
                id=1,
                telegram_bot_token=settings.TELEGRAM_BOT_TOKEN,
                quota_threshold_percent=80.0,
                quota_critical_percent=100.0,
                early_warning_percent=60.0,
                early_warning_days_remaining=15,
                alert_on_offline=False,
                cooldown_hours=24,
                sync_interval_minutes=15,
                is_enabled=True,
            )
            db.add(cfg)
            db.commit()
            db.refresh(cfg)
        elif not cfg.telegram_bot_token:
            cfg.telegram_bot_token = settings.TELEGRAM_BOT_TOKEN
            db.commit()

        bots_count = db.query(TelegramBot).count()
        if bots_count > 0:
            return  # Bots already exist, nothing to seed

        logger.info("No Telegram bots found in database. Initializing recovery/seed process...")

        # 1. Try reading from persistent JSON files
        config_data = None
        for p in CONFIG_PATHS:
            if p.exists():
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        config_data = json.load(f)
                    logger.info(f"Loaded Telegram seed configuration from {p}")
                    break
                except Exception as err:
                    logger.warning(f"Failed to parse {p}: {err}")

        # 2. Extract or fallback to recovered Milicic defaults
        if config_data and "bots" in config_data and config_data["bots"]:
            # Multiple bots format
            bot_map = {}
            for b_data in config_data["bots"]:
                bot = TelegramBot(
                    name=b_data.get("name", "Alertas Infra MILICIC"),
                    token=b_data.get("token", settings.TELEGRAM_BOT_TOKEN),
                    bot_username=b_data.get("bot_username", "inframilicic_bot"),
                    bot_id=b_data.get("bot_id") or b_data.get("token", "").split(":")[0],
                    is_default=b_data.get("is_default", True),
                    is_active=b_data.get("is_active", True),
                )
                db.add(bot)
                db.commit()
                db.refresh(bot)
                old_id = b_data.get("id")
                if old_id:
                    bot_map[old_id] = bot.id
                default_bot_id = bot.id

            # Add channels
            for ch_data in config_data.get("channels", []):
                target_bot_id = bot_map.get(ch_data.get("bot_id"), default_bot_id)
                existing = db.query(TelegramChannel).filter(TelegramChannel.chat_id == ch_data["chat_id"]).first()
                if not existing:
                    ch = TelegramChannel(
                        name=ch_data["name"],
                        chat_id=ch_data["chat_id"],
                        bot_id=target_bot_id,
                        is_active=ch_data.get("is_active", True),
                    )
                    db.add(ch)
                else:
                    existing.bot_id = target_bot_id
            db.commit()

        elif config_data and "bot" in config_data:
            # Single bot format (telegram_seed.json)
            b_info = config_data["bot"]
            default_bot = TelegramBot(
                name=b_info.get("name", "Alertas Infra MILICIC"),
                token=b_info.get("token", settings.TELEGRAM_BOT_TOKEN),
                bot_username=b_info.get("bot_username", "inframilicic_bot"),
                bot_id=b_info.get("bot_id") or b_info.get("token", "").split(":")[0],
                is_default=b_info.get("is_default", True),
                is_active=b_info.get("is_active", True),
            )
            db.add(default_bot)
            db.commit()
            db.refresh(default_bot)

            for ch_data in config_data.get("channels", []):
                existing = db.query(TelegramChannel).filter(TelegramChannel.chat_id == ch_data["chat_id"]).first()
                if not existing:
                    ch = TelegramChannel(
                        name=ch_data["name"],
                        chat_id=ch_data["chat_id"],
                        bot_id=default_bot.id,
                        is_active=ch_data.get("is_active", True),
                    )
                    db.add(ch)
                else:
                    existing.bot_id = default_bot.id
            db.commit()
        else:
            # Fallback directly to settings
            token_val = settings.TELEGRAM_BOT_TOKEN
            t_prefix = token_val.split(":")[0] if ":" in token_val else None
            default_bot = TelegramBot(
                name=settings.TELEGRAM_BOT_NAME,
                token=token_val,
                bot_username=settings.TELEGRAM_BOT_USERNAME,
                bot_id=t_prefix,
                is_default=True,
                is_active=True,
            )
            db.add(default_bot)
            db.commit()
            db.refresh(default_bot)

            # Default Milicic channel
            existing = db.query(TelegramChannel).filter(TelegramChannel.chat_id == settings.TELEGRAM_DEFAULT_CHAT_ID).first()
            if not existing:
                default_ch = TelegramChannel(
                    name="Telegram Milicic",
                    chat_id=settings.TELEGRAM_DEFAULT_CHAT_ID,
                    bot_id=default_bot.id,
                    is_active=True,
                )
                db.add(default_ch)
            else:
                existing.bot_id = default_bot.id
            db.commit()

        logger.info("Default Telegram bot and channels successfully seeded and active.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding default Telegram configuration: {e}")
