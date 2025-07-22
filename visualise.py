from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI()

# Define the directory where your static files (HTML, CSS, JS) are located
STATIC_DIR = "visualisation"

# Mount the  files directory
app.mount("/visualisation", StaticFiles(directory=STATIC_DIR), name="visualisation")

@app.get("/")
async def read_root():
    """
    Serves the main HTML file when accessing the root URL ("/").
    """
    html_file_path = os.path.join(STATIC_DIR, "marketplace_visualiser.html")
    return FileResponse(html_file_path, media_type="text/html")

if __name__ == "__main__":
    import uvicorn
    # Run the FastAPI app using Uvicorn server
    uvicorn.run(
        "visualise:app",  # 'visualise' is the filename without .py, 'app' is the FastAPI instance
        host="0.0.0.0",  # Allows external access
        port=8000,       # Standard port for FastAPI
        reload=True      # Enable auto-reload during development
    )