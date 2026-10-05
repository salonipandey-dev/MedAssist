from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {"message": "MedAssist backend is running"}