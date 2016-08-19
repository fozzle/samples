/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

var toggleButton = document.getElementById('toggleCanvas');
var startButton = document.getElementById('startButton');
var callButton = document.getElementById('callButton');
var hangupButton = document.getElementById('hangupButton');
callButton.disabled = true;
hangupButton.disabled = true;
toggleButton.onclick = toggle;
startButton.onclick = start;
callButton.onclick = call;
hangupButton.onclick = hangup;

var startTime;
var localVideo = document.getElementById('localVideo');
var remoteVideo = document.getElementById('remoteVideo');

localVideo.addEventListener('loadedmetadata', function() {
  trace('Local video videoWidth: ' + this.videoWidth +
    'px,  videoHeight: ' + this.videoHeight + 'px');
});

remoteVideo.addEventListener('loadedmetadata', function() {
  trace('Remote video videoWidth: ' + this.videoWidth +
    'px,  videoHeight: ' + this.videoHeight + 'px');
});

remoteVideo.onresize = function() {
  trace('Remote video size changed to ' +
    remoteVideo.videoWidth + 'x' + remoteVideo.videoHeight);
  // We'll use the first onsize callback as an indication that video has started
  // playing out.
  if (startTime) {
    var elapsedTime = window.performance.now() - startTime;
    trace('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
    startTime = null;
  }
};

var newStream = null;
var localStream;
var pc1;
var pc2;
var offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

function getName(pc) {
  return (pc === pc1) ? 'pc1' : 'pc2';
}

function getOtherPc(pc) {
  return (pc === pc1) ? pc2 : pc1;
}

function gotStream(stream) {
  trace('Received local stream');
  localVideo.srcObject = stream;
  localStream = stream;
  callButton.disabled = false;
}

function toggle(){
  if (localVideo.style.display === 'none'){
    localVideo.style.display = 'inline'
  } else {
    localVideo.style.display = 'none'
  }
}

function start() {
  trace('Requesting local stream');
  startButton.disabled = true;
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true
  })
  .then(gotStream)
  .catch(function(e) {
    alert('getUserMedia() error: ' + e.name);
  });
}

function call() {
  callButton.disabled = true;
  hangupButton.disabled = false;
  trace('Starting call');
  startTime = window.performance.now();
  if(!newStream) {
    newStream = new MediaStream();

    document.getElementById('localVideo').captureStream().getVideoTracks().forEach(function(t) {
      newStream.addTrack(t);
    });
    localStream.getAudioTracks().forEach(function(t){
      newStream.addTrack(t);
    });
  }

  var servers = null;
  pc1 = new RTCPeerConnection(servers);
  trace('Created local peer connection object pc1');
  pc1.onicecandidate = function(e) {
    onIceCandidate(pc1, e);
  };
  pc2 = new RTCPeerConnection(servers);
  trace('Created remote peer connection object pc2');
  pc2.onicecandidate = function(e) {
    onIceCandidate(pc2, e);
  };
  pc1.oniceconnectionstatechange = function(e) {
    onIceStateChange(pc1, e);
  };
  pc2.oniceconnectionstatechange = function(e) {
    onIceStateChange(pc2, e);
  };
  pc2.onaddstream = gotRemoteStream;

  pc1.addStream(newStream);
  trace('Added local stream to pc1');

  trace('pc1 createOffer start');
  pc1.createOffer(
    offerOptions
  ).then(
    onCreateOfferSuccess,
    onCreateSessionDescriptionError
  );
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function onCreateOfferSuccess(desc) {
  trace('Offer from pc1\n' + desc.sdp);
  trace('pc1 setLocalDescription start');
  pc1.setLocalDescription(desc).then(
    function() {
      onSetLocalSuccess(pc1);
    },
    onSetSessionDescriptionError
  );
  trace('pc2 setRemoteDescription start');
  pc2.setRemoteDescription(desc).then(
    function() {
      onSetRemoteSuccess(pc2);
    },
    onSetSessionDescriptionError
  );
  trace('pc2 createAnswer start');
  // Since the 'remote' side has no media stream we need
  // to pass in the right constraints in order for it to
  // accept the incoming offer of audio and video.
  pc2.createAnswer().then(
    onCreateAnswerSuccess,
    onCreateSessionDescriptionError
  );
}

function onSetLocalSuccess(pc) {
  trace(getName(pc) + ' setLocalDescription complete');
}

function onSetRemoteSuccess(pc) {
  trace(getName(pc) + ' setRemoteDescription complete');
}

function onSetSessionDescriptionError(error) {
  trace('Failed to set session description: ' + error.toString());
}

function gotRemoteStream(e) {
  remoteVideo.srcObject = e.stream;
  trace('pc2 received remote stream');
}

function onCreateAnswerSuccess(desc) {
  trace('Answer from pc2:\n' + desc.sdp);
  trace('pc2 setLocalDescription start');
  pc2.setLocalDescription(desc).then(
    function() {
      onSetLocalSuccess(pc2);
    },
    onSetSessionDescriptionError
  );
  trace('pc1 setRemoteDescription start');
  pc1.setRemoteDescription(desc).then(
    function() {
      onSetRemoteSuccess(pc1);
    },
    onSetSessionDescriptionError
  );
}

function onIceCandidate(pc, event) {
  if (event.candidate) {
    getOtherPc(pc).addIceCandidate(
      new RTCIceCandidate(event.candidate)
    ).then(
      function() {
        onAddIceCandidateSuccess(pc);
      },
      function(err) {
        onAddIceCandidateError(pc, err);
      }
    );
    trace(getName(pc) + ' ICE candidate: \n' + event.candidate.candidate);
  }
}

function onAddIceCandidateSuccess(pc) {
  trace(getName(pc) + ' addIceCandidate success');
}

function onAddIceCandidateError(pc, error) {
  trace(getName(pc) + ' failed to add ICE Candidate: ' + error.toString());
}

function onIceStateChange(pc, event) {
  if (pc) {
    trace(getName(pc) + ' ICE state: ' + pc.iceConnectionState);
    console.log('ICE state change event: ', event);
  }
}

function hangup() {
  trace('Ending call');
  pc1.close();
  pc2.close();
  pc1 = null;
  pc2 = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
}

function clock(){
  var now = new Date();
  var ctx = document.getElementById('localVideo').getContext('2d');
  ctx.save();
  ctx.clearRect(0,0,150,150);
  ctx.translate(75,75);
  ctx.scale(0.4,0.4);
  ctx.rotate(-Math.PI/2);
  ctx.strokeStyle = "black";
  ctx.fillStyle = "white";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";

  // Hour marks
  ctx.save();
  for (var i=0;i<12;i++){
    ctx.beginPath();
    ctx.rotate(Math.PI/6);
    ctx.moveTo(100,0);
    ctx.lineTo(120,0);
    ctx.stroke();
  }
  ctx.restore();

  // Minute marks
  ctx.save();
  ctx.lineWidth = 5;
  for (i=0;i<60;i++){
    if (i%5!=0) {
      ctx.beginPath();
      ctx.moveTo(117,0);
      ctx.lineTo(120,0);
      ctx.stroke();
    }
    ctx.rotate(Math.PI/30);
  }
  ctx.restore();

  var sec = now.getSeconds();
  var min = now.getMinutes();
  var hr  = now.getHours();
  hr = hr>=12 ? hr-12 : hr;

  ctx.fillStyle = "black";

  // write Hours
  ctx.save();
  ctx.rotate( hr*(Math.PI/6) + (Math.PI/360)*min + (Math.PI/21600)*sec )
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(-20,0);
  ctx.lineTo(80,0);
  ctx.stroke();
  ctx.restore();

  // write Minutes
  ctx.save();
  ctx.rotate( (Math.PI/30)*min + (Math.PI/1800)*sec )
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(-28,0);
  ctx.lineTo(112,0);
  ctx.stroke();
  ctx.restore();

  // Write seconds
  ctx.save();
  ctx.rotate(sec * Math.PI/30);
  ctx.strokeStyle = "#D40000";
  ctx.fillStyle = "#D40000";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-30,0);
  ctx.lineTo(83,0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0,0,10,0,Math.PI*2,true);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(95,0,10,0,Math.PI*2,true);
  ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.arc(0,0,3,0,Math.PI*2,true);
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#325FA2';
  ctx.arc(0,0,142,0,Math.PI*2,true);
  ctx.stroke();

  ctx.restore();

  window.requestAnimationFrame(clock);
}

window.requestAnimationFrame(clock);


