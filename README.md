# TL;DW

Too Long; Didn't Watch!
Forked from [here](https://github.com/stong/tldw) and adapted to run using `ollama`.



# Build (under Windows)

## Backend
- `python -m venv venv`
- `.\venv\Scripts\activate.bat`
- `pip install -r requirements.txt`


## Frontend
- get [node.js with npm](https://nodejs.org/en/download/)
- install yarn: `npm i -g yarn`
- `cd youtube-summarizer`
- `yarn install`



# Run

## Backend
- `.\venv\Scripts\activate.bat`
- `python backend.py --model llama3.2:latest`
- if you change the port from its default 5000, you will need to adapt the port accordingly in the src/App.tsx file.


## Frontend
- `cd youtube-summarizer`
- `yarn dev --port 80` (without port, the default is pot 5173)
- Go to `http://localhost`