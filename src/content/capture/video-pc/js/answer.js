/*
*  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/

'use strict';

const rightVideo = document.getElementById('rightVideo');


let pc2;

let startTime;
var joinedAtLeastOnce = false;

const sessionIDInput = document.getElementById("session-id");
const sessionIDSubmit = document.getElementById("submit-session-id");

if (isDemo) {
  sessionIDInput.value = sessionID;
  sessionIDInput.disabled = true;
  sessionIDSubmit.disabled = true;
}

sessionIDSubmit.onclick = () => {
  sessionIDInput.value = sessionIDInput.value.toUpperCase();
  sessionID = sessionIDInput.value;

  if (sessionID.length == 0) {
    window.alert("session id cannot be empty");
    return;
  } 
  submitSessionID();
};

var completeWS = function() {
  websocket = new WebSocket(WSROOT);
  websocket.onopen = () => {
    console.log('ws init');
    sessionIDInput.disabled = false;
    sessionIDSubmit.disabled = false;

    if(sessionID) {
      submitSessionID();
    }
  };

  websocket.onerror = (event) => {
    document.getElementById("log").textContent = JSON.stringify(event);
  };

  websocket.onclose = () => {
    completeWS();
  }

  websocket.onmessage = event => {
    let result = JSON.parse(event.data);
    
    if (result.type == "session-id-fail") {
      sessionIDInput.value = "";
      sessionIDInput.disabled = false;
      sessionIDSubmit.disabled = false;
      sessionID = undefined;
    } else if (result.type == "offerDesc") {
    // ws: listen for offer desc and set it as remote desc
      call(result.stun);
      console.log(`offer from pc1:
        ${result.desc.sdp}`);
      console.log('pc2 setRemoteDescription start');
      pc2.setRemoteDescription(result.desc, () => onSetRemoteSuccess(pc2), onSetSessionDescriptionError);
      console.log('pc2 createAnswer start');
      pc2.createAnswer(onCreateAnswerSuccess, onCreateSessionDescriptionError);
    } else if (result.type == "session-id-confirm") {
      joinedAtLeastOnce = true;
    } else if (result.type =="candidate") {
      // ws: listen for ice cand from pc2 and add it
      let toAdd = result.candidate ? new IceCandidate({
        candidate: result.candidate.candidate,
        sdpMLineIndex: result.candidate.sdpMLineIndex,
      }) : result.candidate;
      pc2.addIceCandidate(toAdd)
      .then(
          () => onAddIceCandidateSuccess(pc2),
          err => onAddIceCandidateError(pc2, err, result.candidate)
      );
    }
  };
};
completeWS();
rightVideo.onloadedmetadata = () => {
  console.log(`Remote video videoWidth: ${rightVideo.videoWidth}px,  videoHeight: ${rightVideo.videoHeight}px`);
};

rightVideo.onresize = () => {
  console.log(`Remote video size changed to ${rightVideo.videoWidth}x${rightVideo.videoHeight}`);
  // We'll use the first onresize callback as an indication that
  // video has started playing out.
  if (startTime) {
    const elapsedTime = window.performance.now() - startTime;
    console.log('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
    startTime = null;
  }
};

rightVideo.addEventListener('mousemove', e => {
  // Get the bounding rectangle of the video element
  const rect = rightVideo.getBoundingClientRect();

  // Calculate the position of the mouse relative to the video element
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const width = rect.width;
  const height = rect.height;

  // Log the mouse position to remote peer connection
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(`m${x/width};${y/height}`);
  }
});

function call(stun) {
  console.log('Starting call');
  startTime = window.performance.now();
  pc2 = new RTCPeerConnection(stun);
  console.log('Created remote peer connection object pc2');
  pc2.onicecandidate = e => onIceCandidate(pc2, e);
  pc2.oniceconnectionstatechange = e => onIceStateChange(pc2, e);
  pc2.ontrack = gotRemoteStream;
  
  pc2.ondatachannel = (event) => {
    dataChannel = event.channel;
    
    dataChannel.onopen = (event) => {
      console.log("Data channel opened");
    };
    
    dataChannel.onmessage = (event) => {
      console.log("Received message:", event.data);
    };
    
    dataChannel.onclose = (event) => {
      console.log("Data channel closed");
    };
  };
}

function onCreateSessionDescriptionError(error) {
  console.log(`Failed to create session description: ${error.toString()}`);
}

function onSetLocalSuccess(pc) {
  console.log(`${getName(pc)} setLocalDescription complete`);
}

function onSetRemoteSuccess(pc) {
  console.log(`${getName(pc)} setRemoteDescription complete`);
}

function onSetSessionDescriptionError(error) {
  console.log(`Failed to set session description: ${error.toString()}`);
}

function gotRemoteStream(event) {
  if (rightVideo.srcObject !== event.streams[0]) {
    rightVideo.srcObject = event.streams[0];
    console.log('pc2 received remote stream', event);
  }
}

function onCreateAnswerSuccess(desc) {
  console.log(`Answer from pc2:
${desc.sdp}`);
  console.log('pc2 setLocalDescription start');
  pc2.setLocalDescription(desc, () => onSetLocalSuccess(pc2), onSetSessionDescriptionError);
  
  let toPass = {};
  toPass.type = "answerDesc";
  toPass.desc = desc;
  websocket.send(JSON.stringify(toPass));
}

function onIceCandidate(pc, event) {
  let toPass = {};
  toPass.type = "candidate";
  toPass.candidate = event.candidate;
  websocket.send(JSON.stringify(toPass));
  console.log(`${getName(pc)} ICE candidate: 
${event.candidate ?
    event.candidate.candidate : '(null)'}`);
}

function onAddIceCandidateSuccess(pc) {
  console.log(`${getName(pc)} addIceCandidate success`);
}

function onAddIceCandidateError(pc, error) {
  console.log(`${getName(pc)} failed to add ICE Candidate: ${error.toString()}`);
}

function onIceStateChange(pc, event) {
  if (pc) {
    console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
    console.log('ICE state change event: ', event);
  }
}

function getName(pc) {
  return 'pc2';
}
