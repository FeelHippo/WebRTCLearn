'use strict';

let localConnection;
let remoteConnection;
let sendChannel;
let receiveChannel;

const dataChannelValue = document.getElementById('value');
const dataChannelSend = document.getElementById('result');
const dataChannelReceive = document.getElementById('reset');

dataChannelSend.onclick = () => {
    const data = dataChannelValue.value;
    console.log('~~~ Sending Data: ' + data);
    sendChannel.send(JSON.stringify({ name: 'message', value: data }));
};
dataChannelReceive.onclick = () => {
    console.warn('~~~ Resetting Data ~~~');
    dataChannelValue.value = ''
  };

window.onload = () => {
    try {
        console.info('~~~ INIT ~~~');
        const socket = io('http://localhost:3030', { auth: { token: 'SIGNALING123' } });
    
        // to connect two remote clients:
        // https://webrtc.org/getting-started/peer-connections
    
        connectToSignalingChannel(socket);
    
        setUpLocalConnection(socket);
        // setUpRemoteConnection();
    
        console.info('~~~ OK ~~~');
    } catch (error) {
        console.error(error);
    }
}

const connectToSignalingChannel = (socket) => {
    if (socket) {
        socket.on(
            'connect',
            () => socket.emit("ready", 'DevFilipposMacBookProlocalClient' + new Date().toISOString(), 'admin'),
        );
        socket.connect();
        socket.on('message', async (message) => {
            // here we receive the connection offer from the calling peer 
            console.log('~~~ MESSAGE RECEIVED: ' + message);
            if (message.offer) {
                console.log(`~~~ Message Received: OFFER`);
                localConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
                const answer = await localConnection.createAnswer();
                await localConnection.setLocalDescription(answer);
                // #2 the receiving peer returns an answer
                socket.send({ 'answer': answer });
            }
            if (message.icecandidate) {
                console.log(`~~~ Message Received: icecandidate`);
                try {
                    await localConnection.addIceCandidate(message.iceCandidate);
                } catch (e) {
                    console.error('Error adding received ice candidate', e);
                }
            }
        });
        sendChannel = socket;
    }
}

const setUpLocalConnection = (socket) => {

    // https://dashboard.metered.ca/developers/app/66817ac534ec0778f267fa61
    var peerConfiguration = {};

    (async() => {
        const response = await fetch("https://yourappname.metered.live/api/v1/turn/credentials?apiKey=W6WKeOdumE0fIEmey1j47we_ZLgwai92zPwYAnMNmOFF2aBE");
        const iceServers = await response.json();
        peerConfiguration.iceServers = iceServers
    })();

    window.localConnection = localConnection = new RTCPeerConnection(peerConfiguration);
    console.info(`~~~ Connection Created: ${localConnection.currentLocalDescription} ~~~`);
    
    localConnection.createOffer().then(
        emitOffer,
        onCreateSessionDescriptionError
    );

    // sendChannel = localConnection.createDataChannel('sendDataChannel');
    // console.info(`~~~ sendChannel label: ${sendChannel.label} ~~~`);

    localConnection.addEventListener('icecandidate', iceEvent => {
        if (!!iceEvent.candidate) {
            console.info('~~~ addEventListener icecandidate: ' + iceEvent.candidate);
            socket.send({'icecandidate': iceEvent.candidate});
            onIceCandidate(localConnection, iceEvent);
        }
    });

    localConnection.addEventListener('connectionstatechange', event => {
        if (localConnection.connectionState === 'connected') {
            console.log('~~~ Peers connected ~~~');
        }
    });

    // sendChannel.onopen = onSendChannelStateChange;
    // sendChannel.onclose = onSendChannelStateChange;

}

// const setUpRemoteConnection = () => {

//     window.remoteConnection = remoteConnection = new RTCPeerConnection(undefined);
//     console.info(`~~~ ${remoteConnection.currentRemoteDescription} ~~~`);

//     remoteConnection.onicecandidate = iceEvent => {
//         onIceCandidate(remoteConnection, iceEvent);
//     }
//     remoteConnection.ondatachannel = receiveChannelCallback;

// }

const onIceCandidate = (client, iceEvent) => {
    const otherClient = client === localConnection
        ? remoteConnection
        : localConnection;
    otherClient
        .addIceCandidate(iceEvent.candidate)
        .then(
            console.info('~~~ added candidate ~~~' + iceEvent.candidate), 
            console.error
        );
}

// const onSendChannelStateChange = () => {
//     const readyState = sendChannel.readyState;
//     console.info(`~~~ ${readyState} ~~~`);
// }

const receiveChannelCallback = (iceEvent) => {
    console.warn(`~~~ Callback ${iceEvent} ~~~`);
    receiveChannel = iceEvent.channel;
    receiveChannel.onmessage = onReceiveMessageCallback;
    receiveChannel.onopen = onReceiveChannelStateChange;
    receiveChannel.onclose = onReceiveChannelStateChange;
}

const onReceiveMessageCallback = (iceEvent) => {
    console.log(`~~~~ Message: ${iceEvent.type} ~~~`);
}

const onReceiveChannelStateChange = () => {
    const readyState = receiveChannel.readyState;
    console.log(`~~~ ${readyState} ~~~`);
}

const emitOffer = (offer) => {
    sendChannel.emit('offer', (offer));
    localConnection.setLocalDescription(offer);
    console.log(`~~~ ${offer.sdp} ~~~`);
    remoteConnection.setRemoteDescription(offer);
    remoteConnection.createAnswer().then(
        updateDescription,
        onCreateSessionDescriptionError
    );
}
  
const updateDescription = (offer) => {
    remoteConnection.setLocalDescription(offer);
    console.log(`~~~ ${offer.sdp} ~~~`);
    localConnection.setRemoteDescription(offer);
}

const onCreateSessionDescriptionError = (error) => {
    console.log(`~~~ ${error} ~~~`);
}