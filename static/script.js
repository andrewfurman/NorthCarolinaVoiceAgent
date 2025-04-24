// static/script.js
// This JavaScript File Is Used To Interact With The ChatGPT Real Time Voice Model

document.addEventListener('DOMContentLoaded', function() {
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const statusDiv = document.getElementById('status');
    const remoteAudio = document.getElementById('remoteAudio'); // Get the audio element

    let pc; // RTCPeerConnection
    let dc; // RTCDataChannel
    let localStream; // User's microphone stream

    startButton.addEventListener('click', startChat);
    stopButton.addEventListener('click', stopChat);

    async function startChat() {
        console.log('=== Starting Chat Session ===');
        console.log('1. Initial setup...');
        console.log('- Setting status and button states');
        statusDiv.textContent = 'Connecting...';
        startButton.disabled = true;
        stopButton.disabled = false;

        try {
            // 1. Get an ephemeral key from your server
            console.log('2. Requesting session token...');
            console.log('- Making fetch request to /session endpoint');
            const tokenResponse = await fetch("/session");
            console.log('- Session response status:', tokenResponse.status);
            if (!tokenResponse.ok) {
                 const errorData = await tokenResponse.json();
                 console.error('Session token request failed:', {
                     status: tokenResponse.status,
                     statusText: tokenResponse.statusText,
                     errorData
                 });
                 throw new Error(`Failed to get session token: ${tokenResponse.status} ${tokenResponse.statusText} - ${JSON.stringify(errorData.details || errorData.error)}`);
            }
            const sessionData = await tokenResponse.json();
            const EPHEMERAL_KEY = sessionData.client_secret?.value; // Use optional chaining
            // Use the model specified in the session response or fallback if needed
            const REALTIME_MODEL = sessionData.model || "gpt-4o-realtime-preview";

            if (!EPHEMERAL_KEY) {
                 throw new Error("Ephemeral key (client_secret.value) not found in session response.");
            }
            console.log(`Using model: ${REALTIME_MODEL}`);
            console.log('Ephemeral key received.');

            console.log('3. Setting up WebRTC...');
            // 2. Create a peer connection
            pc = new RTCPeerConnection();
            console.log('- RTCPeerConnection created');

            // 3. Set up to play remote audio from the model
            pc.ontrack = e => {
                console.log('Remote track received:', e.track);
                if (e.streams && e.streams[0]) {
                    remoteAudio.srcObject = e.streams[0];
                    console.log('Assigned remote stream to audio element.');
                     // Attempt to play audio programmatically after user interaction
                     remoteAudio.play().catch(e => console.error("Audio play failed:", e));
                } else {
                     console.warn("Received track event without streams.");
                     // Fallback for older browser compatibility if needed, but less common now
                }
            };

            // Handle connection state changes for debugging/status updates
             pc.onconnectionstatechange = event => {
                  statusDiv.textContent = `Connection State: ${pc.connectionState}`;
                  console.log(`Peer Connection State: ${pc.connectionState}`);
                  if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
                      stopChat(); // Clean up if connection drops
                  }
             };

             pc.onicecandidateerror = event => {
                 console.error("ICE Candidate Error:", event);
                 statusDiv.textContent = `Error: ICE Candidate Error - ${event.errorCode}: ${event.errorText}`;
             };

             pc.onicegatheringstatechange = () => console.log(`ICE Gathering State: ${pc.iceGatheringState}`);

            // 4. Add local audio track for microphone input in the browser
            console.log('Requesting microphone access...');
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: true
            });
            localStream.getTracks().forEach(track => {
                 pc.addTrack(track, localStream);
                 console.log('Local audio track added.');
             });

            // 5. Set up data channel for sending and receiving events
            dc = pc.createDataChannel("oai-events");
            console.log('Data channel created.');

            dc.onopen = () => {
                 console.log('Data channel opened.');
                 statusDiv.textContent = 'Data channel open. Ready to chat!';
                 // Example: Send initial configuration or greeting if needed
                 // dc.send(JSON.stringify({ type: 'configure', settings: {} }));
             };

            // =============================================================
            // === VVVVVVVVVVVV MODIFICATION START VVVVVVVVVVVV ===
            // =============================================================
            dc.onmessage = (event) => {
                // Log the raw message for debugging
                // console.log('Raw Data channel message received:', event.data);

                try {
                    const messageData = JSON.parse(event.data);

                    // Log the parsed message type for easier debugging
                    // console.log(`Parsed message type: ${messageData.type}`);

                    // Check for the specific event that contains the final transcript for an utterance
                    // Based on OpenAI docs and your transcript_seen.md, 'response.audio_transcript.done' is key.
                    if (messageData.type === "response.audio_transcript.done" && messageData.transcript) {
                        console.log("Received final transcript:", messageData.transcript);
                        // Check if the display function from print_transcript.js exists
                        if (typeof displayFinalTranscript === 'function') {
                            // Call the function to add the transcript to the page
                            displayFinalTranscript(messageData.transcript);
                        } else {
                            console.error("displayFinalTranscript function is not defined. Ensure print_transcript.js is loaded correctly before script.js tries to use it.");
                        }
                    }
                     // Add handlers for other potentially useful events if needed
                     else if (messageData.type === "error") {
                         console.error("Received error event from Realtime API:", messageData);
                         statusDiv.textContent = `Error: ${messageData.message || 'Unknown API error'}`;
                     }
                     else if (messageData.type === "session.created") {
                         console.log("Session created event received:", messageData.session);
                     }
                     // Add more 'else if' blocks here to handle other event types
                     // (e.g., 'input_audio_buffer.speech_started', 'response.created', etc.)
                     // if you need to react to them in the UI or logic.

                } catch (e) {
                    console.error("Failed to parse data channel message or handle event:", e);
                    console.error("Raw data received:", event.data); // Log raw data on error
                }
            };
            // =============================================================
            // === ^^^^^^^^^^^^ MODIFICATION END ^^^^^^^^^^^^ ===
            // =============================================================


             dc.onclose = () => {
                 console.log('Data channel closed.');
                 // Only update status if the connection isn't already closing/closed
                 if (pc && pc.connectionState !== 'closed' && pc.connectionState !== 'disconnected') {
                    statusDiv.textContent = 'Data channel closed.';
                 }
             };

             dc.onerror = (error) => {
                 console.error('Data channel error:', error);
                 statusDiv.textContent = `Error: Data channel error - ${error.message || 'Unknown error'}`;
             };

            // 6. Start the session using the Session Description Protocol (SDP)
            console.log('Creating SDP offer...');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            console.log('Local description set.');

            const baseUrl = "https://api.openai.com/v1/realtime";
            // Use the model name obtained from the session endpoint
            const sdpResponse = await fetch(`${baseUrl}?model=${REALTIME_MODEL}`, {
                method: "POST",
                body: offer.sdp, // Send the SDP offer text directly
                headers: {
                    Authorization: `Bearer ${EPHEMERAL_KEY}`,
                    "Content-Type": "application/sdp" // Crucial header
                },
            });

            if (!sdpResponse.ok) {
                const errorText = await sdpResponse.text();
                 throw new Error(`SDP exchange failed: ${sdpResponse.status} ${sdpResponse.statusText} - ${errorText}`);
            }

            const answerSdp = await sdpResponse.text();
            console.log('Received SDP answer.');
            const answer = {
                type: "answer",
                sdp: answerSdp,
            };
            await pc.setRemoteDescription(answer);
            console.log('Remote description set. WebRTC setup complete.');
            // Status update moved to dc.onopen for better user feedback timing
            // statusDiv.textContent = 'Connected!';

        } catch (error) {
            console.error('Error starting chat:', error);
            statusDiv.textContent = `Error: ${error.message}`;
            stopChat(); // Clean up on error
            startButton.disabled = false;
            stopButton.disabled = true;
        }
    }

    function stopChat() {
        console.log('Stopping chat...');
        if (dc) {
            // dc.onclose will handle status update unless connection already closed
            dc.close();
            dc = null; // Nullify after closing
            console.log('Data channel close initiated.');
        }
        if (pc) {
             // Stop sending tracks
             pc.getSenders().forEach(sender => {
                 if (sender.track) {
                     sender.track.stop();
                 }
             });
              // Stop receiving tracks (though srcObject = null is often sufficient)
              pc.getReceivers().forEach(receiver => {
                  if (receiver.track) {
                      receiver.track.stop();
                  }
              });

            // pc.onconnectionstatechange handles status update
            pc.close();
            pc = null; // Nullify after closing
            console.log('Peer connection close initiated.');
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
            console.log('Local microphone stream stopped.');
        }
        // Clear the audio source
         if (remoteAudio) {
            remoteAudio.srcObject = null;
            remoteAudio.pause(); // Ensure it's paused
            remoteAudio.load(); // Reset the element
         }

        // Update status definitively if not already handled by events
        if (statusDiv.textContent !== 'Disconnected') {
             statusDiv.textContent = 'Disconnected';
        }
        startButton.disabled = false;
        stopButton.disabled = true;
        console.log('Chat stopped and resources released.');
    }
});