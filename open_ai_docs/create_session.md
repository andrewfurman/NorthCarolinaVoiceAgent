Preffered Voice = "alloy"

Realtime
Beta
Communicate with a GPT-4o class model in real time using WebRTC or WebSockets. Supports text and audio inputs and ouputs, along with audio transcriptions. Learn more about the Realtime API.

Session tokens
REST API endpoint to generate ephemeral session tokens for use in client-side applications.

Create session
post

https://api.openai.com/v1/realtime/sessions
Create an ephemeral API token for use in client-side applications with the Realtime API. Can be configured with the same session parameters as the session.update client event.

It responds with a session object, plus a client_secret key which contains a usable ephemeral API token that can be used to authenticate browser clients for the Realtime API.

Request body
input_audio_format
string

Optional
Defaults to pcm16
The format of input audio. Options are pcm16, g711_ulaw, or g711_alaw. For pcm16, input audio must be 16-bit PCM at a 24kHz sample rate, single channel (mono), and little-endian byte order.

input_audio_noise_reduction
object

Optional
Defaults to null
Configuration for input audio noise reduction. This can be set to null to turn off. Noise reduction filters audio added to the input audio buffer before it is sent to VAD and the model. Filtering the audio can improve VAD and turn detection accuracy (reducing false positives) and model performance by improving perception of the input audio.


Show properties
input_audio_transcription
object

Optional
Configuration for input audio transcription, defaults to off and can be set to null to turn off once on. Input audio transcription is not native to the model, since the model consumes audio directly. Transcription runs asynchronously through the /audio/transcriptions endpoint and should be treated as guidance of input audio content rather than precisely what the model heard. The client can optionally set the language and prompt for transcription, these offer additional guidance to the transcription service.


Show properties
instructions
string

Optional
The default system instructions (i.e. system message) prepended to model calls. This field allows the client to guide the model on desired responses. The model can be instructed on response content and format, (e.g. "be extremely succinct", "act friendly", "here are examples of good responses") and on audio behavior (e.g. "talk quickly", "inject emotion into your voice", "laugh frequently"). The instructions are not guaranteed to be followed by the model, but they provide guidance to the model on the desired behavior.

Note that the server sets default instructions which will be used if this field is not set and are visible in the session.created event at the start of the session.

max_response_output_tokens
integer or "inf"

Optional
Maximum number of output tokens for a single assistant response, inclusive of tool calls. Provide an integer between 1 and 4096 to limit output tokens, or inf for the maximum available tokens for a given model. Defaults to inf.

modalities
Optional
The set of modalities the model can respond with. To disable audio, set this to ["text"].

model
string

Optional
The Realtime model used for this session.

output_audio_format
string

Optional
Defaults to pcm16
The format of output audio. Options are pcm16, g711_ulaw, or g711_alaw. For pcm16, output audio is sampled at a rate of 24kHz.

temperature
number

Optional
Defaults to 0.8
Sampling temperature for the model, limited to [0.6, 1.2]. For audio models a temperature of 0.8 is highly recommended for best performance.

tool_choice
string

Optional
Defaults to auto
How the model chooses tools. Options are auto, none, required, or specify a function.

tools
array

Optional
Tools (functions) available to the model.


Show properties
turn_detection
object

Optional
Configuration for turn detection, ether Server VAD or Semantic VAD. This can be set to null to turn off, in which case the client must manually trigger model response. Server VAD means that the model will detect the start and end of speech based on audio volume and respond at the end of user speech. Semantic VAD is more advanced and uses a turn detection model (in conjuction with VAD) to semantically estimate whether the user has finished speaking, then dynamically sets a timeout based on this probability. For example, if user audio trails off with "uhhm", the model will score a low probability of turn end and wait longer for the user to continue speaking. This can be useful for more natural conversations, but may have a higher latency.


Show properties
voice
string

Optional
The voice the model uses to respond. Voice cannot be changed during the session once the model has responded with audio at least once. Current voice options are alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, shimmer, and verse.

Returns
The created Realtime session object, plus an ephemeral key

Example request
curl -X POST https://api.openai.com/v1/realtime/sessions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-realtime-preview",
    "modalities": ["audio", "text"],
    "instructions": "You are a friendly assistant."
  }'
Response
{
  "id": "sess_001",
  "object": "realtime.session",
  "model": "gpt-4o-realtime-preview",
  "modalities": ["audio", "text"],
  "instructions": "You are a friendly assistant.",
  "voice": "alloy",
  "input_audio_format": "pcm16",
  "output_audio_format": "pcm16",
  "input_audio_transcription": {
      "model": "whisper-1"
  },
  "turn_detection": null,
  "tools": [],
  "tool_choice": "none",
  "temperature": 0.7,
  "max_response_output_tokens": 200,
  "client_secret": {
    "value": "ek_abc123", 
    "expires_at": 1234567890
  }
}
