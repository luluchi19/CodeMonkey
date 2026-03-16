import modal

from app.main import app as fastapi_app

APP_NAME = "codemonkey-ai-sidecar"

image = (
    modal.Image.debian_slim()
    .pip_install_from_requirements("requirements.txt")
    .add_local_python_source("app", "lib")
)

app = modal.App(name=APP_NAME)


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("codemonkey-ai")],
    cpu=1.0,
    memory=1024,
    timeout=60 * 10,
)
@modal.asgi_app()
def fastapi():
    return fastapi_app
