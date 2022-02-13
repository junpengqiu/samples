/*
*  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/

'use strict';
const serversGoogleStun = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

const serversStunOrg = {
  iceServers: [
    {
      urls: ['stun:stun.stunprotocol.org:3478'],
    },
  ],
  iceCandidatePoolSize: 10,
};


const serversEmpty = {
};

const WSROOT = "wss://junpengqiu.com/qrgank/";
const websocket = new WebSocket(WSROOT);

function onAddIceCandidateError(pc, error, candidate) {
  console.log(`${getName(pc)} failed to add ICE Candidate: ${error.toString()}`);
  console.log(`candidate json: ${JSON.stringify(candidate)}`)
}

function getStunChoice() {
  let choice = document.querySelector('input[name="stun-choice"]:checked').value;
  if (choice == "google") {
    return serversGoogleStun;
  }else if (choice == "stunorg"){
    return serversStunOrg;
  } else {
    return serversEmpty;
  }
}

function xableStunChoice(enable) {
  let radioButtons = document.querySelectorAll('input[name="stun-choice"]');
  for (let idx = 0; idx < radioButtons.length; idx++) {
    let radioButton = radioButtons[idx];
    radioButton.disabled = !enable;
  }
}

function enableStunChoice() {
  xableStunChoice(true);
}

function disableStunChoice() {
  xableStunChoice(false);
}