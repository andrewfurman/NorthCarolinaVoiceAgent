import os
import requests
import json # Added for JSON loading in error handling
from flask import Flask, render_template, jsonify, request
from plans.plans_routes import plans_bp
from plans.plans_model import Base
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
import os

# --- Configuration ---
# It's highly recommended to load sensitive keys from environment variables
# Ensure OPENAI_API_KEY is set in your environment
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
# Use the latest recommended model or the specific one you need
# Update model string as per OpenAI documentation or announcements
# Check OpenAI docs for the current recommended preview model.
OPENAI_REALTIME_MODEL = os.environ.get("OPENAI_REALTIME_MODEL", "gpt-4o-realtime-preview") # Using a reasonable default
OPENAI_SESSION_URL = "https://api.openai.com/v1/realtime/sessions"

# <<< START MODIFICATION: Update filename for instructions >>>
INSTRUCTIONS_FILENAME = "call_center_guide.md" # Define the filename for instructions
# <<< END MODIFICATION >>>


# --- Database Initialization ---
database_url = os.environ.get('DATABASE_URL')
if database_url:
    # Use connection pooling with retry settings
    engine = create_engine(
        database_url,
        poolclass=QueuePool,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,  # Recycle connections before Neon's 5-minute timeout
        pool_pre_ping=True  # Enable connection health checks
    )

    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db_session = Session()
else:
    print("Warning: DATABASE_URL not found in environment variables")

# --- Flask App Initialization ---
app = Flask(__name__, static_url_path='/static')
app.register_blueprint(plans_bp)

# --- Helper Function to Read Instructions File ---
# <<< START MODIFICATION: Update function/comments to be more generic >>>
def read_instructions_from_file():
    """Reads the instructions content from the specified file."""
    try:
        # Get the directory of the current script to reliably find the instructions file
        script_dir = os.path.dirname(os.path.abspath(__file__))
        instructions_file_path = os.path.join(script_dir, INSTRUCTIONS_FILENAME)

        print(f"Attempting to read instructions file: {instructions_file_path}") # Log path

        with open(instructions_file_path, 'r', encoding='utf-8') as f: # Specify encoding
            content = f.read().strip()
            print(f"Successfully read instructions from '{INSTRUCTIONS_FILENAME}'.")
            return content

    except FileNotFoundError:
        print(f"Warning: Instructions file '{INSTRUCTIONS_FILENAME}' not found at {instructions_file_path}. Proceeding without custom instructions.")
        return None # Return None if file not found
    except Exception as e:
        print(f"Error reading instructions file '{INSTRUCTIONS_FILENAME}': {e}")
        return None # Return None on other errors
# <<< END MODIFICATION >>>

# --- Routes ---
@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html')

@app.route('/session', methods=['GET'])
def get_session_token():
    """
    Server-side endpoint to securely generate an ephemeral OpenAI API key (token)
    and includes the instructions from the guide file during session creation.
    The client-side JavaScript will call this endpoint.
    """
    print("Session endpoint called - starting session creation process")
    
    if not OPENAI_API_KEY:
        print("Error: OPENAI_API_KEY not found in environment variables")
        return jsonify({"error": "OpenAI API key not configured on the server."}), 500
        
    print(f"Using OpenAI model: {OPENAI_REALTIME_MODEL}")

    # Read the instructions from the specified file before making the API call
    # <<< START MODIFICATION: Call updated function name >>>
    instructions_text = read_instructions_from_file() # Can be None if file not found/error
    # <<< END MODIFICATION >>>


    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    # Base payload for the session creation
    payload = {
        "model": OPENAI_REALTIME_MODEL,
        "voice": "alloy",
        # "modalities": ["audio", "text"], # Optional: Uncomment/adjust if needed

        # --- Optional: Input Transcription settings ---
        # Verify the exact parameter name and structure from API docs if you need this.
        # "input_audio_transcription": {
        #     "model": "whisper-1",
        #     # "language": "en"
        # },

        # --- CORRECT Turn Detection Settings ---
        "turn_detection": {          # <<< The key MUST be exactly "turn_detection"
            "type": "semantic_vad",  # Value: type set to semantic_vad
            "eagerness": "high"      # Value: eagerness set to high
            # 'create_response': True, # Default, usually no need to specify
            # 'interrupt_response': True # Default, usually no need to specify
        }
        # Add any other required top-level parameters for the specific API endpoint here
    }

    # Only add 'instructions' to the payload if the content was read successfully
    # <<< START MODIFICATION: Use updated variable name >>>
    if instructions_text:
        payload["instructions"] = instructions_text
        print(f"Including instructions from '{INSTRUCTIONS_FILENAME}' in session creation request.")
    else:
         print(f"No instructions file '{INSTRUCTIONS_FILENAME}' found or read error; session will be created without custom instructions.")
    # <<< END MODIFICATION >>>


    try:
        print(f"Requesting session from OpenAI with payload: {json.dumps(payload)}") 
        print(f"Making request to URL: {OPENAI_SESSION_URL}")
        response = requests.post(OPENAI_SESSION_URL, headers=headers, json=payload)
        print(f"Response status code: {response.status_code}")
        print(f"Response headers: {response.headers}")
        response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)

        session_data = response.json()

        # The ephemeral key is within 'client_secret'
        if "client_secret" not in session_data:
            print(f"Error: 'client_secret' not found in OpenAI response: {session_data}")
            return jsonify({"error": "Failed to retrieve client_secret from OpenAI session.", "details": session_data}), 500

        # Log successful session creation with the actual session ID from the response
        print(f"Successfully created OpenAI session ID: {session_data.get('id', 'N/A')}")
        # We don't need to send the instructions text back to the client anymore
        # as it's handled during session creation.
        return jsonify(session_data)

    except requests.exceptions.RequestException as e:
        # Log the error for debugging on the server
        print(f"Error requesting OpenAI session token: {e}")
        # Provide a generic error message to the client
        error_details = str(e)
        if e.response is not None:
            try:
                # Attempt to get JSON error details from OpenAI response
                error_details = e.response.json()
            except json.JSONDecodeError:
                # Fallback to text if response is not JSON
                error_details = e.response.text
        print(f"Error details from OpenAI API: {error_details}")
        return jsonify({"error": "Failed to communicate with OpenAI API.", "details": error_details}), 502 # Bad Gateway might be appropriate
    except Exception as e:
        # Catch any other unexpected errors during the process
        print(f"An unexpected error occurred in /session endpoint: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500

# --- Run the App ---
if __name__ == '__main__':
    # Note: Use host='0.0.0.0' for accessibility within Docker/Replit,
    # but be mindful of security implications in production environments.
    # Use environment variable for port if available, default to 8080 or 5000
    port = int(os.environ.get('PORT', 8080)) # Using 8080 as a common alternative
    # Debug mode should ideally be off in production
    # Read FLASK_DEBUG env var, default to 'false' if not set
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() in ('true', '1', 't')
    print(f"Starting Flask app on host 0.0.0.0 port {port} with debug mode: {debug_mode}")
    app.run(host='0.0.0.0', port=port, debug=debug_mode)