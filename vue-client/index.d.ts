export {};

declare global {
  interface Window {
    localConnection: RTCPeerConnection;
    remoteConnection: RTCPeerConnection;
  }
}