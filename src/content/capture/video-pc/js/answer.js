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

var sessionID;
const sessionIDInput = document.getElementById("session-id");
const sessionIDSubmit = document.getElementById("submit-session-id");

sessionIDSubmit.onclick = () => {
  sessionIDInput.value = sessionIDInput.value.toUpperCase();
  let inp = sessionIDInput.value;

  if (inp.length == 0) {
    window.alert("session id cannot be empty");
    return;
  } 

  let toPass = {};
  toPass.type = "session-id-submit";
  toPass.sessionID = inp;
  sessionIDInput.disabled = true;
  sessionIDSubmit.disabled = true;
  websocket.send(JSON.stringify(toPass));
};

websocket.onopen = () => {
  sessionIDInput.disabled = false;
  sessionIDSubmit.disabled = false;
};

websocket.onerror = (event) => {
  document.getElementById("log").textContent = event;
};

websocket.onclose = () => {
  document.getElementById("log").textContent = "disconnected from signal server";
};

websocket.onmessage = event => {
  let result = JSON.parse(event.data);
  
  if (result.type == "session-id-confirm") {
    sessionID = result.sessionID;
    // disableStunChoice();
    // call();
  } else if (result.type == "session-id-fail") {
    sessionIDInput.value = "";
    sessionIDInput.disabled = false;
    sessionIDSubmit.disabled = false;
  } else if (result.type == "offerDesc") {
   // ws: listen for offer desc and set it as remote desc
    call(result.stun);
    console.log(`offer from pc1:
      ${result.desc.sdp}`);
    console.log('pc2 setRemoteDescription start');
    pc2.setRemoteDescription(result.desc, () => onSetRemoteSuccess(pc2), onSetSessionDescriptionError);
    console.log('pc2 createAnswer start');
    pc2.createAnswer(onCreateAnswerSuccess, onCreateSessionDescriptionError);
  } else if (result.type =="candidate") {
    // ws: listen for ice cand from pc2 and add it
    pc2.addIceCandidate(result.candidate)
     .then(
         () => onAddIceCandidateSuccess(pc2),
         err => onAddIceCandidateError(pc2, err, result.candidate)
     );
  }
};

websocket.onopen = () => {
  console.log('ws init');
  
  sessionIDInput.disabled = false;
  sessionIDSubmit.disabled = false;
};

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

function call(stun) {
  console.log('Starting call');
  startTime = window.performance.now();
  pc2 = new RTCPeerConnection(stun);
  console.log('Created remote peer connection object pc2');
  pc2.onicecandidate = e => onIceCandidate(pc2, e);
  pc2.oniceconnectionstatechange = e => onIceStateChange(pc2, e);
  pc2.ontrack = gotRemoteStream;
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
