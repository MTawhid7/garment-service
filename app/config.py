from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Paths are resolved relative to CWD (the project root when running uvicorn).
    assets_path: Path = Path("assets")
    body_yaml: str = "bodies/mean_all.yaml"
    output_dir: Path = Path("outputs")

    model_config = SettingsConfigDict(env_prefix="GARMENT_", env_file=".env", extra="ignore")

    @property
    def body_path(self) -> Path:
        return self.assets_path / self.body_yaml

    @property
    def design_params_path(self) -> Path:
        return self.assets_path / "design_params/default.yaml"

    @property
    def sim_props_dir(self) -> Path:
        return self.assets_path / "Sim_props"


settings = Settings()
