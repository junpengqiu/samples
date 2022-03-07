/*
*  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/

'use strict';

const leftVideo = document.getElementById('leftVideo');
let stream;
var calledAtLeastOnce = false;
var senders = [];

let pc1;
const offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

let startTime;

var displayMediaOptions = {
  video: {
    cursor: "always"
  },
  audio: false
};

function updateSessionID() {
  document.getElementById("sessionID").textContent = sessionID;
}

var completeWS = function() {
  websocket = new WebSocket(WSROOT);
  websocket.onopen = () => {
    console.log('ws init');

    if (sessionID) {
      submitSessionID();
      updateSessionID();
    } else {
      websocket.send(JSON.stringify({
        type: "register"
      }));
    }
  };

  websocket.onmessage = event =>
  {
    let result = JSON.parse(event.data);
    if (result.type == "registered") {
      sessionID = result.sessionID;
      updateSessionID();
    } else if (result.type == "other-client-joined") {
      document.getElementById("create-stream").textContent = "Share Screen/共享屏幕";
      document.getElementById("create-stream").disabled = false;
    } else if (result.type == "answerDesc") {
      // ws: listen for answer desc and set it as remote desc
      console.log(`Answer from pc2:
        ${result.desc.sdp}`);
      console.log('pc1 setRemoteDescription start');
      pc1.setRemoteDescription(result.desc, () => onSetRemoteSuccess(pc1), onSetSessionDescriptionError);
    } else if (result.type =="candidate") {
      // ws: listen for ice cand from pc2 and add it
      console.log(`received candidate:\n ${JSON.stringify(result.candidate)}`);
      let toAdd = new IceCandidate({
        candidate: result.candidate.candidate,
        sdpMLineIndex: result.candidate.sdpMLineIndex,
      });
      pc1.addIceCandidate(toAdd)
        .then(
            () => onAddIceCandidateSuccess(pc1),
            err => onAddIceCandidateError(pc1, err, result.candidate)
        );
    }
  };

  websocket.onclose = () => {
    completeWS();
  }
};

completeWS();

async function createStream() {
  if (leftVideo.captureStream) {
    console.log('Captured stream from leftVideo with captureStream',
        stream);
    call();
  } else if (leftVideo.mozCaptureStream) {
    console.log('Captured stream from leftVideo with mozCaptureStream()',
        stream);
    call();
  } else {
    console.log('captureStream() not supported');
  }
}

// Video tag capture must be set up after video tracks are enumerated.
// leftVideo.oncanplay = maybeCreateStream;

document.getElementById("create-stream").onclick = async () => {
  disableStunChoice();
  createStream();
}

leftVideo.play();

async function call() {
  console.log('Starting call');
  stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
  leftVideo.srcObject = stream;
  startTime = window.performance.now();
  const videoTracks = stream.getVideoTracks();
  const audioTracks = stream.getAudioTracks();
  if (videoTracks.length > 0) {
    console.log(`Using video device: ${videoTracks[0].label}`);
  }
  if (audioTracks.length > 0) {
    console.log(`Using audio device: ${audioTracks[0].label}`);
  }
  if(!calledAtLeastOnce) {
    pc1 = new RTCPeerConnection(getStunChoice());
    console.log('Created local peer connection object pc1');
    pc1.onicecandidate = e => onIceCandidate(pc1, e);
    // pc2.onicecandidate = e => onIceCandidate(pc2, e);
    pc1.oniceconnectionstatechange = e => onIceStateChange(pc1, e);

    stream.getTracks().forEach(track => {
      senders.push(pc1.addTrack(track, stream));
    });
    console.log('Added local stream to pc1');

    console.log('pc1 createOffer start');
    pc1.createOffer(onCreateOfferSuccess, onCreateSessionDescriptionError, offerOptions);
    calledAtLeastOnce = true;
    document.getElementById("create-stream").textContent = "Change Screen/切换屏幕";
  } else {
    let newTrack = stream.getTracks()[0]
    senders[0].replaceTrack(newTrack);
  }
}

function onCreateSessionDescriptionError(error) {
  console.log(`Failed to create session description: ${error.toString()}`);
}

function onCreateOfferSuccess(desc) {
  console.log(`Offer from pc1
${desc.sdp}`);
  console.log('pc1 setLocalDescription start');
  pc1.setLocalDescription(desc, () => onSetLocalSuccess(pc1), onSetSessionDescriptionError);
  console.log('pc2 setRemoteDescription start');
  // pc2.setRemoteDescription(desc, () => onSetRemoteSuccess(pc2), onSetSessionDescriptionError);
  // pc2.createAnswer(onCreateAnswerSuccess, onCreateSessionDescriptionError);
  // pass desc to pc2, wait for pc2 to set remote desc and create answer
  let toPass = {};
  toPass.type = "offerDesc";
  toPass.desc = desc;
  toPass.stun = getStunChoice();

  websocket.send(JSON.stringify(toPass));

  // Since the 'remote' side has no media stream we need
  // to pass in the right constraints in order for it to
  // accept the incoming offer of audio and video.  
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

function onIceCandidate(pc, event) {
  let toPass = {};
  toPass.type = "candidate";
  toPass.candidate = event.candidate;
  websocket.send(JSON.stringify(toPass));
  console.log(`ICE candidate: 
${event.candidate ?
    event.candidate.candidate : '(null)'}`);
}

function onAddIceCandidateSuccess(pc) {
  console.log(`${getName(pc)} addIceCandidate success`);
}

function onIceStateChange(pc, event) {
  if (pc) {
    console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
    console.log('ICE state change event: ', event);
  }
}

function getName(pc) {
  return 'pc1';
}
