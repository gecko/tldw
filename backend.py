from flask import Flask, request, jsonify
from flask_cors import CORS
from functools import wraps
import time
import dotenv
from typing import Optional, Dict, Any
import os
import json
import gzip
from youtube import VideoExtractor, Summarizer, validate_youtube_url
import traceback

CACHE_DIR = './cache'


app = Flask(__name__)
app.config['MAX_VIDEO_DURATION'] = int(os.getenv('MAX_VIDEO_DURATION', 7200))  # 2 hours in seconds

cors = CORS(app)  # Enable CORS for all routes

# More specific CORS configuration
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5173", # for local development
        ],
        "methods": ["GET", "POST", "OPTIONS"],
    }
})

# Load environment variables
dotenv.load_dotenv()

# Rate limiting decorator
def rate_limit(limit=5):  # 60 requests per minute by default
    def decorator(f):
        requests = {}
        
        @wraps(f)
        def wrapped(*args, **kwargs):
            now = time.time()
            ip = request.remote_addr
            
            # Clean old entries
            requests[ip] = [t for t in requests.get(ip, []) if now - t < 60]
            
            if len(requests.get(ip, [])) >= limit:
                return jsonify({
                    "error": "Rate limit exceeded. Please try again later."
                }), 429
            
            requests.setdefault(ip, []).append(now)
            return f(*args, **kwargs)
        return wrapped
    return decorator

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200


def get_cached_caption(video_id: str) -> str:
    cache_file = os.path.join(CACHE_DIR, video_id + '.caption.txt.gz')
    if os.path.isfile(cache_file):
        cached_stuff = gzip.open(cache_file, 'rt').read()
        return cached_stuff
    return None


@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        vid_id = data.get('video_id')
        message = data['question']

        captions = get_cached_caption(vid_id)
        summarizer = Summarizer(model=app.config['MODEL'])
        response = summarizer.answer(message, captions)
        
        if not response:
            return jsonify({
                "error": "Failed to get response"
            }), 500
        
        return jsonify({
            "success": True,
            "answer": response
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error processing chat: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({
            "error": f"An error occurred: {str(e)}"
        }), 500




@app.route('/api/summarize', methods=['POST'])
# @rate_limit()
def summarize_video():
    data = request.get_json()
    
    if not data or 'url' not in data:
        return jsonify({
            "error": "Missing URL in request body"
        }), 400
    
    url = data['url']
    
    if not validate_youtube_url(url):
        return jsonify({
            "error": "Invalid YouTube URL"
        }), 400
    
    try:
        extractor = VideoExtractor()
        summarizer = Summarizer(model=app.config['MODEL'])

        # Download metadata
        video_info = extractor.extract_video_info(url)
        if not video_info:
            return jsonify({
                "error": "Failed to download video info"
            }), 500

        video_id = video_info['id']
        duration = video_info['duration']

        # If video too long, reject
        print(f'Video id: {video_id}, duration: {duration} = {duration//60}:{duration%60:02}')
        if duration >= app.config['MAX_VIDEO_DURATION']:
            return jsonify({
                "error": "Too long video"
            }), 400

        # Get captions
        caption_track = extractor.get_captions_by_priority(video_info)
        if not caption_track:
            return jsonify({
                'error': 'Captions are not available',
                'video_id': video_id
            }), 500
        ext = caption_track['ext']
        
        app.logger.info(f'Using captions track: {caption_track["name"]} ({ext})')
        
        # Download captions
        downloaded_content = extractor.download_captions(video_id, caption_track)
        
        # Parse captions
        caption_text = extractor.parse_captions(ext, downloaded_content)

        # save caption text to cache
        cache_file = os.path.join(CACHE_DIR, video_id + '.caption.txt.gz')
        with gzip.open(cache_file, 'wt') as f:
            f.write(caption_text)

        print(f'Caption length: {len(caption_text)}')

        # Generate summaries
        summaries = summarizer.summarize(caption_text, video_info)

        if not summaries:
            return jsonify({
                "error": "Failed to summarize"
            }), 500
        
        # Get the thumbnail with highest preference
        thumbnails = video_info.get('thumbnails', [])
        thumbnail_url = None
        if thumbnails:
            best_thumbnail = max(thumbnails, key=lambda x: x.get('preference', 0))
            thumbnail_url = best_thumbnail.get('url')

        aspect_ratio = video_info.get('aspect_ratio', 1.78)
        webpage_url = video_info.get('webpage_url', 'https://www.youtube.com/watch?v=' + video_id)

        return jsonify({
            "success": True,
            "error": "",
            "video_id": video_id,
            "title": video_info.get('title', ''),
            "thumbnail_url": thumbnail_url,
            "aspect_ratio": aspect_ratio,
            "webpage_url": webpage_url,
            "summary": summaries
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error processing video: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({
            "error": f"An error occurred: {str(e)}"
        }), 500

if __name__ == '__main__':
    from waitress import serve
    import argparse
    parser = argparse.ArgumentParser(description='Server configuration')
    parser.add_argument('--port', type=int, default=5000, help='Port number (default: 5000)')
    parser.add_argument('--model', default=os.getenv('MODEL'), help='Name of the ollama model (default: MODEL environment variable in .env file.)')
    parser.add_argument('--max-duration', type=int, default=app.config['MAX_VIDEO_DURATION'],
                       help='Maximum video duration in seconds (default: MAX_VIDEO_DURATION environment variable or 7200)')
    args = parser.parse_args()
    app.config['MAX_VIDEO_DURATION'] = args.max_duration
    app.config['MODEL'] = args.model
    print(f'Serving on port {args.port} with max duration {args.max_duration} seconds and model {args.model}')
    serve(app, host="0.0.0.0", port=args.port)
