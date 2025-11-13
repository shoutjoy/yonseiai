// app.js (1부)

// 전역 상태 변수 설정
let myPeer, conn, call, myVideoStream, myRole, myName, roomId, roomPw, peerIdFromUrl;
let currentFacingMode = 'user';
let micEnabled = true, camEnabled = true, screenSharing = false;
let recorder, recorded = [], recording = false;

// DOM 바로잡기
function doc(id) {return document.getElementById(id);}

// UI 진입 화면/상태 변경
function showTeacher() {
  doc('main-section').classList.add('hidden');
  doc('teacher-auth').classList.remove('hidden');
}
function showStudent() {
  doc('main-section').classList.add('hidden');
  doc('student-join').classList.remove('hidden');
}
// 교사 인증
function teacherLogin() {
  let pw = doc('teacher-pw').value;
  if(pw === 'a123456!') {
    doc('teacher-auth').classList.add('hidden');
    doc('teacher-create').classList.remove('hidden');
  } else {
    doc('teacher-auth-msg').innerText = "비밀번호가 틀립니다!";
  }
}

// 방 생성/학생입장
function createRoom() {
  roomId = doc('room-id').value.trim();
  roomPw = doc('room-pw').value.trim();
  if(!roomId || !roomPw) { alert('ID와 비번 입력!'); return;}
  myRole = 'teacher'; myName = '교사';
  doc('teacher-create').classList.add('hidden');
  doc('video-section').classList.remove('hidden');
  doc('role-title').innerText = "교사용 강의방 (ID: "+roomId+")";
  prepareMediaAndStart(myRole, function() {
    startPeer(roomId);
    const url = location.origin + location.pathname + "?room=" + encodeURIComponent(roomId);
    doc('url-share').innerHTML = "학생에게 <b>아래 주소</b> 또는<br><b>ID: "+roomId+", 비번: "+roomPw+"</b>를 전달하세요.<br><input value='"+url+"' style='width:95%' readonly>";
    doc('url-share').style.display='';
  });
}
function joinRoomByInfo() {
  roomId = doc('join-room-id').value.trim();
  roomPw = doc('join-room-pw').value.trim();
  myName = doc('join-name').value.trim();
  if(!roomId || !roomPw || !myName) { alert('정보 입력!'); return;}
  myRole = 'student';
  doc('student-join').classList.add('hidden');
  doc('role-title').innerText = myName+"(학생)";
  doc('video-section').classList.remove('hidden');
  prepareMediaAndStart(myRole, function() { startPeer(); });
}
function joinRoomByUrl() {
  myName = doc('url-join-name').value.trim();
  if(!myName) { alert('이름 입력!'); return;}
  myRole = 'student';
  roomId = peerIdFromUrl; roomPw = null;
  doc('student-url-join').classList.add('hidden');
  doc('role-title').innerText = myName+"(학생)";
  doc('video-section').classList.remove('hidden');
  prepareMediaAndStart(myRole, function() { startPeer(); });
}
window.onload = function() {
  const params = new URLSearchParams(window.location.search);
  if(params.has('room')) {
    doc('main-section').classList.add('hidden');
    doc('student-url-join').classList.remove('hidden');
    peerIdFromUrl = params.get('room');
  }
}

async function prepareMediaAndStart(role, gotoFunc) {
  try {
    let constraints = {
      video: { facingMode: currentFacingMode, width: {ideal:640}, height: {ideal:480} },
      audio: true
    };
    myVideoStream = await navigator.mediaDevices.getUserMedia(constraints);
    doc('my-video').srcObject = myVideoStream;
    micEnabled = true; camEnabled = true;
    resetBtnColor();
    gotoFunc();
  } catch(e) {
    alert('카메라/마이크 사용에 실패했습니다.\n[권한 차단, 주소창 옆 자물쇠 아이콘에서 허용 후 새로고침]\n[' + e.name + '] ' + e.message);
    location.reload();
  }
}
function resetBtnColor() {
  setBtnColor('mic-toggle-btn', micEnabled);
  setBtnColor('cam-toggle-btn', camEnabled);
  setBtnColor('switch-cam-btn', true);
  setBtnColor('screen-share-btn', !screenSharing);
}
function setBtnColor(id, on) {
  let btn = doc(id);
  if(btn){
    btn.classList.toggle('on', on);
    btn.classList.toggle('off', !on);
  }
}
async function switchCamera() {
  currentFacingMode = currentFacingMode==='user' ? 'environment' : 'user';
  try {
    let newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode, width: {ideal:640}, height: {ideal:480} },
      audio: true
    });
    replaceLocalStream(newStream);
    resetBtnColor();
  } catch(e){
    alert('카메라 전환 실패: ' + e.message);
  }
}
function toggleMic() {
  micEnabled = !micEnabled;
  if(myVideoStream) myVideoStream.getAudioTracks().forEach(t=>t.enabled = micEnabled);
  setBtnColor('mic-toggle-btn', micEnabled);
  doc('mic-toggle-btn').innerText = micEnabled?"마이크 끄기":"마이크 켜기";
}
function toggleCam() {
  camEnabled = !camEnabled;
  if(myVideoStream) myVideoStream.getVideoTracks().forEach(t=>t.enabled = camEnabled);
  setBtnColor('cam-toggle-btn', camEnabled);
  doc('cam-toggle-btn').innerText = camEnabled?"카메라 끄기":"카메라 켜기";
}
async function shareScreen() {
  if(screenSharing) {
    switchCamera();
    screenSharing = false;
    doc('screen-share-btn').innerText = "화면공유";
    setBtnColor('screen-share-btn', true);
    return;
  }
  let screenStream;
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
  } catch(e) {
    alert('화면 공유를 시작할 수 없습니다: '+e.message); return;
  }
  screenSharing = true;
  replaceLocalStream(screenStream, true);
  doc('screen-share-btn').innerText = "화면공유중지";
  setBtnColor('screen-share-btn', false);
  screenStream.getVideoTracks()[0].onended = function() {
    shareScreen();
  }
}
function replaceLocalStream(newStream, isScreen=false) {
  if(myVideoStream) myVideoStream.getTracks().forEach(t=>t.stop());
  myVideoStream = newStream;
  doc('my-video').srcObject = myVideoStream;
  if(call && call.peerConnection) {
    const pc = call.peerConnection;
    const senders = pc.getSenders();
    let vSender = senders.find(sender => sender.track && sender.track.kind==='video');
    if(vSender && myVideoStream.getVideoTracks().length>0) vSender.replaceTrack(myVideoStream.getVideoTracks()[0]);
    let aSender = senders.find(sender => sender.track && sender.track.kind==='audio');
    if(aSender && myVideoStream.getAudioTracks().length>0) aSender.replaceTrack(myVideoStream.getAudioTracks()[0]);
  }
  if(isScreen) { newStream.getVideoTracks()[0].onended = function() { shareScreen(); }; }
}

function startPeer(id=null) {
  myPeer = new Peer(id||undefined, {debug:1});
  myPeer.on('open', function(peerId) {
    if(myRole === 'student') {
      conn = myPeer.connect(roomId, {metadata: {pw: roomPw, name: myName}});
      conn.on('open', () => { setupConn(conn); chatMsg('<시스템> 교사 연결!'); });
      call = myPeer.call(roomId, myVideoStream, {metadata:{pw: roomPw, name: myName}});
      call.on('stream', remoteStream=>{
        doc('peer-video').srcObject = remoteStream;
        showConnectedMsg();
      });
    }
  });
  if(myRole === 'teacher') {
    myPeer.on('connection', (newConn)=>{
      if(newConn.metadata?.pw && newConn.metadata.pw!==roomPw) {
        newConn.on('open', ()=>{ newConn.send({type:'deny', msg:'비밀번호가 다릅니다!'}); newConn.close(); }); return;
      }
      conn = newConn;
      conn.on('open', ()=> {setupConn(conn); chatMsg('<시스템> 학생 접속!'); showConnectedMsg();});
    });
    myPeer.on('call', (incomingCall)=>{
      if(incomingCall.metadata?.pw && incomingCall.metadata.pw!==roomPw) { incomingCall.close(); return; }
      incomingCall.answer(myVideoStream);
      incomingCall.on('stream', (remoteStream)=>{
        doc('peer-video').srcObject = remoteStream;
        showConnectedMsg();
      });
      call = incomingCall;
    });
  }
}
function showConnectedMsg() {
  let div = doc('connection-msg');
  div.style.display='';
  div.innerText = '서로 연결되었습니다!';
  setTimeout(()=>{div.style.display='none'},3000);
}
// app.js (2부)

// 파일전송/채팅
let recvBuffer = [], recvFileName = "", recvSize = 0, recvTotal = 0;
const MB100 = 100*1024*1024;
function sendFile(file) {
  const chunkSize = 64*1024;
  let offset = 0;
  chatMsg(`나: <span style="color:#22A">[${file.name}] 전송 중...</span>`, true);
  function sendChunk() {
    const reader = new FileReader();
    reader.onload = function(e) {
      let chunk = e.target.result;
      let done = offset+chunkSize >= file.size;
      conn.send({type:'file', name:myName, fileName: file.name, size: file.size, data: chunk, done});
      offset += chunkSize;
      if(offset < file.size) sendChunk();
      else chatMsg(`나: <b style="color:#298d29;">[${file.name}] 전송 완료</b>`, true);
    };
    let slice = file.slice(offset, offset+chunkSize);
    reader.readAsArrayBuffer(slice);
  }
  sendChunk();
}
doc('file-input').addEventListener('change', function(e){
  const file = e.target.files[0];
  if(!file || !conn || !conn.open) return;
  if(file.size > MB100) { alert("최대 100MB 파일만 지원."); return;}
  sendFile(file);
  e.target.value='';
});
function setupConn(c) {
  c.on('data', msg=>{
    if(msg.type==='deny'){ alert(msg.msg); location.reload(); }
    else if(msg.type==='chat') chatMsg(msg.name+": "+msg.msg);
    else if(msg.type==='file') {
      recvBuffer.push(msg.data);
      recvFileName = msg.fileName;
      recvSize += msg.data.byteLength || msg.data.size || 0;
      recvTotal = msg.size;
      if(msg.done) {
        let blob = new Blob(recvBuffer), url = URL.createObjectURL(blob);
        chatMsg(`<b>${msg.name}</b>: <button onclick="downloadFile('${url}', '${recvFileName}')">[${recvFileName}] 다운로드</button> <span style='color:#888;'>(크기:${(recvTotal/1048576).toFixed(2)}MB)</span>`);
        recvBuffer = []; recvFileName=""; recvSize=recvTotal=0;
      }
    }
  });
  c.on('close', ()=> chatMsg('<시스템> 상대방 연결 종료'));
}
function downloadFile(url, name){
  let a = document.createElement('a'); a.href=url; a.download=name; a.click();
}
function sendMsg() {
  const input = doc('chat-input');
  const text = input.value.trim();
  if(text.length==0) return;
  chatMsg("나: "+text, true);
  if(conn&&conn.open) conn.send({type:'chat', name:myName, msg:text});
  input.value='';
}
document.addEventListener('keydown', function(e){
  if(doc('chat-input') && document.activeElement===doc('chat-input')) {
    if(e.key==='Enter') sendMsg();
  }
});
function chatMsg(msg, my=false) {
  const div = doc('chat-box');
  div.innerHTML += (my?'<b>':'')+msg+(my?'</b>':'')+"<br>";
  div.scrollTop = div.scrollHeight;
}

// 전체화면/PIP/캡처/녹화 등
function fullscreenVideo(videoId) {
  let video = doc(videoId);
  if (video.requestFullscreen)      video.requestFullscreen();
  else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
  else if (video.msRequestFullscreen)     video.msRequestFullscreen();
}
document.addEventListener('fullscreenchange', ()=>{
  let chatPanel = doc('chat-panel');
  if(document.fullscreenElement) chatPanel.classList.add('floating');
  else chatPanel.classList.remove('floating');
});
async function maximizeVideo(mainId, pipId) {
  let mainVideo = doc(mainId), pipVideo = doc(pipId);
  let big = doc('big-view'), box = doc('big-main');
  big.style.display="flex";
  let clone = mainVideo.cloneNode(true);
  clone.muted = true; clone.srcObject = mainVideo.srcObject;
  box.innerHTML = ''; box.appendChild(doc('big-main').querySelector('button'));
  box.appendChild(clone); clone.play();
  if (document.pictureInPictureEnabled && pipVideo.srcObject) {
    try { pipVideo.requestPictureInPicture(); } catch{}
  }
}
function closeBigView(e){
  if(e.target.id==='big-view' || e.target.tagName==="BUTTON") {
    doc('big-view').style.display="none";
    let box = doc('big-main');
    box.innerHTML = '<button onclick="closeBigView(event)">닫기</button>';
  }
}
function captureVideo(vidId) {
  let video = doc(vidId);
  let canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
  let a = document.createElement('a');
  a.href = canvas.toDataURL("image/png");
  a.download = 'capture_'+Date.now()+'.png';
  a.click();
}
function toggleRecord() {
  if(recording) {
    recorder.stop(); 
    doc('rec-btn').innerText='● 녹화';
    recording=false;
    return;
  }
  let stream = doc('my-video').srcObject;
  recorder = new MediaRecorder(stream, {mimeType:'video/webm'});
  recorded = [];
  recorder.ondataavailable = e => recorded.push(e.data);
  recorder.onstop = ()=>{
    let blob = new Blob(recorded, {type:'video/webm'});
    let url = URL.createObjectURL(blob);
    let a=document.createElement('a');
    a.href=url; a.download='record_'+Date.now()+'.webm'; a.click();
    recorded = [];
  };
  recorder.start();
  doc('rec-btn').innerText='■ 중지';
  recording = true;
}
// 판서도구 새창
function openWhiteboard(){
  if(window.whiteboardWin && !whiteboardWin.closed) {
    whiteboardWin.focus(); return;
  }
  let URLtxt = `
  <!DOCTYPE html><html lang="ko"><head>
    <meta charset="UTF-8"><title>판서도구</title>
    <style>body{margin:0;background:#f2f2fa;}
    #wrap{margin:9px;} #toolbar{margin-bottom:7px;} canvas{border:1.5px solid #aaa;border-radius:6px;background:#fff;}
    #pages{margin-top:8px;}</style>
  </head><body>
  <div id="wrap">
    <div id="toolbar">
      <button onclick="tool='pen';">✏️펜</button>
      <button onclick="tool='eraser';">지우개</button>
      <label>굵기<input type="range" min="1" max="18" id="widen" value="3" onchange="widthVal=this.value"></label>
      <input type="color" id="color" value="#1947cd" onchange="colVal=this.value">
      <button onclick="clearAll()">모두지우기</button>
      <button onclick="addPage()">+페이지</button>
      <button onclick="saveCur('png')">현재페이지PNG</button>
      <button onclick="saveCur('pdf')">현재PDF</button>
      <button onclick="saveAllPDF()">전체PDF</button>
    </div>
    <div id="pages"></div>
    <canvas id="canvas" width=900 height=620 style="touch-action: none;"></canvas>
    <div id="pageInfo"></div>
  </div>
 ​
