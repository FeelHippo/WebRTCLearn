'use strict';

let localConnection;
let sendChannel;
let receiveChannel;

const textInputElement = document.getElementById('value');
const buttonInputElement = document.getElementById('result');
const spanContentElement = document.getElementById('content');

buttonInputElement.onclick = () => {
    const data = textInputElement.value;
    console.log(`|-- Sending Data: ${data}`);
    sendChannel.send(JSON.stringify({ name: 'message', value: data }));
};

window.onload = () => {
    try {
        console.info('|-- Window On Load');
        const socket = io(
            'http://localhost:3030',
            { auth: { token: 'SIGNALING123' } },
        );
    
        // to connect two remote clients:
        // https://webrtc.org/getting-started/peer-connections
    
        connectToSignalingChannel(socket);
        setUpLocalConnection(socket);

    } catch (error) {
        console.error(error);
    }
}

// ICE == Internet Connectivity Establishment
// Signaling is needed in order for two peers to share how they should connect
// this is done via an ICE (signaling) server
const connectToSignalingChannel = (socket) => {
    if (socket) {
        socket.on(
            'connect',
            () => socket.emit(
                'ready',
                // create unique peer id
                'DevFilipposMacBookProlocalClient' + new Date().toISOString(),
                'admin',
            ),
        );
        socket.connect();
        // https://webrtc.org/getting-started/peer-connections#signaling
        socket.on('message', async (message) => {
            // here we receive the connection offer from the calling peer 
            console.log(`|-- MESSAGE RECEIVED: ${message}`);
            // #5 on the receiving side, we wait for an incoming offer
            if (message.offer) {
                console.log(`|-- Offer Received`);
                // #6 set the received offer
                localConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
                console.log(`|-- Emit Answer`);
                // #7 create an answer to the received offer
                const answer = await localConnection.createAnswer();
                await localConnection.setLocalDescription(answer);
                // the calling peer returns an answer
                socket.send({ 'answer': answer });
            }
            if (message.answer) {
                console.log(`|-- Peer Answer to Offer ${message}`);
                const remoteDescription = new RTCSessionDescription(message.answer);
                localConnection.setRemoteDescription(remoteDescription);
            }
            // #9 listen for remote ICE candidates and add them to the local RTCPeerConnection
            if (message.icecandidate) {
                console.log(`|-- Ice Candidate Received`);
                try {
                    await localConnection.addIceCandidate(message.iceCandidate);
                } catch (e) {
                    console.error('Error adding received ice candidate', e);
                }
            }
            if (typeof message == 'string') {
                // #10 use the value received from the message
                const parsedMessage = JSON.parse(message);
                if (parsedMessage.value) {
                    const textNode = document.createTextNode(parsedMessage.value);
                    spanContentElement.appendChild(textNode);
                }
            }
        });
        sendChannel = socket;
    }
}

const setUpLocalConnection = (socket) => {

    // https://dashboard.metered.ca/developers/app/66f41edbe1d5af10c7f1f126
    var peerConfiguration = {};

    // TURN (Traversal Using Relay NAT) open source Server
    // credentials have a limited life span, if the request fails (401) => generate new ones
    (async() => {
        // https://www.metered.ca/docs/turn-rest-api/get-credential/
        const response = await fetch("https://feelhippo.metered.live/api/v1/turn/credentials?apiKey=8mjy59xrP4_4jjTy1NVqtAFNstsxdi7Ljdg2VNf85KHdWtoy");
        const iceServers = await response.json();
        peerConfiguration.iceServers = iceServers
    })();

    // #1 define how the peer connection is set up
    window.localConnection = localConnection = new RTCPeerConnection(peerConfiguration);
    console.info(`|-- Connection Created: ${localConnection.currentLocalDescription}`);
    
    // #2 create an SDP offer
    localConnection.createOffer().then(
        emitOffer,
        onCreateSessionDescriptionError
    );

    // https://webrtc.org/getting-started/peer-connections#trickle_ice
    // signals in what state the ICE gathering is (new, gathering or complete)
    localConnection.addEventListener('icegatheringstatechange', console.info);

    // #8  use a "trickle ice" technique and transmit each ICE candidate to the remote peer as it gets discovered
    // Listen for local ICE candidates on the local RTCPeerConnection
    localConnection.addEventListener('icecandidate', iceEvent => {
        if (!!iceEvent.candidate) {
            console.info(`|-- Ice Candidate Event: ${iceEvent.candidate}`);
            socket.send({'icecandidate': iceEvent.candidate});
            localConnection
                .addIceCandidate(iceEvent.candidate)
                    .then(
                        console.info(`|-- added candidate ${iceEvent.candidate}`), 
                        console.error
                    );
        }
    });

    localConnection.addEventListener('connectionstatechange', event => {
        if (localConnection.connectionState === 'connected') {
            console.log('|-- Peers connected');
        }
    });

}

const receiveChannelCallback = (iceEvent) => {
    console.warn(`|-- Callback ${iceEvent}`);
    receiveChannel = iceEvent.channel;
    receiveChannel.onmessage = onReceiveMessageCallback;
    receiveChannel.onopen = onReceiveChannelStateChange;
    receiveChannel.onclose = onReceiveChannelStateChange;
}

const onReceiveMessageCallback = (iceEvent) => {
    console.log(`|-- Message Callback: ${iceEvent.type}`);
}

const onReceiveChannelStateChange = () => {
    const readyState = receiveChannel.readyState;
    console.log(`|-- Ready State: ${readyState}`);
}

const emitOffer = (offer) => {
    // #3 here we emit the connection offer as the calling peer
    sendChannel.emit('offer', (offer));
    // #4 session description is set as the local description
    localConnection.setLocalDescription(offer);
    console.log(`|-- ${offer.sdp}`);
}

const onCreateSessionDescriptionError = (error) => {
    console.error(`|-- Error: ${error}`);
}