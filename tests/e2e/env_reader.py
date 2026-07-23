"""Lee las variables del .env real del proyecto (mismo formato KEY=VALUE que
load_env_file() en src/config.php) para que estos scripts de Playwright nunca
tengan que hardcodear ADMIN_ACCESS_KEY ni credenciales de BD en el código
fuente de las pruebas."""
import os
import re

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ENV_PATH = os.path.join(PROJECT_ROOT, ".env")


def load_env():
    values = {}
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
            if not m:
                continue
            key, value = m.group(1), m.group(2)
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                value = value[1:-1]
            values[key] = value
    return values


BASE_URL = "http://localhost/portafolio-marco"
STORAGE_STATE_PATH = os.path.join(os.path.dirname(__file__), ".admin_storage_state.json")
