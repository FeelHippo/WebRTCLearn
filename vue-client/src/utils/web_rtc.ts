import { Commit } from 'vuex';
import { io, Socket } from 'socket.io-client';
import os from 'os';
import { type State } from '../store';

export default async (commit: Commit, state: State) => {
    console.info('~~~ INIT ~~~');
    const socket = io('http://localhost:3030', { auth: { token: 'SIGNALING123' }, });

    // to connect two remote clients:
    // https://webrtc.org/getting-started/peer-connections

    connectToSignalingChannel(socket, state);

    // https://dashboard.metered.ca/developers/app/66817ac534ec0778f267fa61
    const response = await fetch("https://filippo_learning.metered.live/api/v1/turn/credentials?apiKey=W6WKeOdumE0fIEmey1j47we_ZLgwai92zPwYAnMNmOFF2aBE");
    const iceServers = await response.json();
    const peerConfiguration = {
        iceServers,
    }

    console.log(peerConfiguration)

    commit('updateState', { name: 'peerConnection', value: new RTCPeerConnection(peerConfiguration) });
    if (state.peerConnection) {
        window.localConnection = state.peerConnection;
        commit('updateState', { name: 'dataChannel', value: state.peerConnection.createDataChannel('sendDataChannel') });
        state.dataChannel.addEventListener('open', (_: any) => {
            console.info('~~~ data channel opened ~~~');
        });
        state.dataChannel.addEventListener('close', (_: any) => {
            console.info('~~~ data channel closed ~~~');
        });
        state.peerConnection.addEventListener(
            'icecandidate',
            async iceEvent => {
                console.info('~~~ icecandidate ~~~', + iceEvent);
                await onIceCandidate(state.peerConnection!, iceEvent, socket);
            },
        );
        state.peerConnection.addEventListener('connectionstatechange', _ => {
            if (state.peerConnection!.connectionState === 'connected') {
                console.log('~~~ Peers connected ~~~');
            }
        });
        state.peerConnection.addEventListener('datachannel', (dataChannelEvent: RTCDataChannelEvent) => {
            commit('updateState', { name: 'dataChannel', value: dataChannelEvent.channel });
            
            state.dataChannel.addEventListener(
                'message',
                ({ data }: { data: any }) => {
                    console.info('~~~ Data received ~~~' + data);
                    commit('updateState', { name: data.name, value: data.value });
                });
        });
    }

    if (state.peerConnection) {
        try {
            // # 1 the calling peer initiates the connection and creates the offer
            const offer: RTCSessionDescriptionInit = await state.peerConnection.createOffer();
            console.warn(`~~~ Offer: ${offer.type}`);
            await state.peerConnection.setLocalDescription(offer);
            // here the offer is sent to the receiving side
            socket.send({ 'offer': offer });
        } catch (error) {
            onCreateSessionDescriptionError(error);
        }
    }

    console.info('~~~ OK ~~~');

}

const connectToSignalingChannel = (
    socket: Socket,
    state: State,
) => {
    if (socket) {
        socket.on(
            'connect',
            () => socket.emit("ready", os.hostname().replace(/[^a-zA-Z]/g, ""), 'admin'),
        );
    }
    socket.connect();
    socket.on('message', async (message) => {
        console.log(`~~~ Message Received: ${Object.entries(message)}`);
        if (message.answer && state.peerConnection) {
            const remoteDesc = new RTCSessionDescription(message.answer);
            await state.peerConnection.setRemoteDescription(remoteDesc);
            console.log('~~~ answer received ~~~')
        }
        if (message.iceCandidate && state.peerConnection) {
            try {
                await state.peerConnection.addIceCandidate(message.iceCandidate);
            } catch (e) {
                console.error('Error adding received ice candidate', e);
            }
        }
    })
}

const onIceCandidate = async (
    client: RTCPeerConnection,
    iceEvent: RTCPeerConnectionIceEvent,
    socket: Socket,
) => {
    console.info(`~~~ onIceCandidate ${client.localDescription?.type} ${iceEvent.candidate} ~~~`);
    if (iceEvent.candidate) {
        socket.send({ 'iceCandidate': iceEvent.candidate });
    }  
}

const onCreateSessionDescriptionError = (error: any) => {
    console.log(`~~~ Error: ${error} ~~~`);
}